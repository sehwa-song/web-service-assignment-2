import { AppError, missing, forbidden, invalidState } from './errors.js';

// TODO-01~04: 업무 규칙과 트랜잭션을 직접 구현합니다. docs/API.md를 먼저 읽으세요.
// actor는 검증된 로그인 사용자입니다. repo의 저장 함수는 권한을 검사하지 않습니다.
// 상태 변경과 이력 저장은 함께 성공하거나 함께 실패해야 합니다.
// 승인 취소와 자동 승급은 신청 2건 + 이력 2건을 한 트랜잭션으로 처리합니다.
export function createApplicationService(repo) {
  function managedApplication(actor, applicationId) {
    const application = repo.application(applicationId);
    if (!application) throw missing('신청');

    const event = repo.event(application.eventId);
    if (actor.role !== 'MANAGER' || actor.id !== event.managerId) throw forbidden();
    return { application, event };
  }

  return {
    apply(actor,eventId) {
      const { db } = repo;
      db.exec('BEGIN IMMEDIATE');
      try {
        if (!repo.event(eventId)) throw missing('행사');
        if (actor.role !== 'STUDENT') throw forbidden();
        const existingApplication = repo.existing(eventId, actor.id);
        if (existingApplication != null) {
          throw new AppError(409, 'ALREADY_APPLIED', '이미 신청한 행사입니다.');
        }

        const application = repo.insert(eventId, actor.id);
        repo.addHistory({
          applicationId: application.id,
          actorId: actor.id,
          action: 'APPLY',
          toStatus: application.status
        });
        db.exec('COMMIT');
        return application;
      } catch (error) {
        if (db.isTransaction) db.exec('ROLLBACK');
        throw error;
      }
    },
    cancel(actor,applicationId) {
      const { db } = repo;
      db.exec('BEGIN IMMEDIATE');
      try {
        const application = repo.application(applicationId);
        if (!application) throw missing('신청');
        if (actor.role !== 'STUDENT' || actor.id !== application.userId) throw forbidden();
        if (application.status !== 'PENDING') throw invalidState();

        const cancelledApplication = repo.setStatus(applicationId, 'CANCELLED');
        repo.addHistory({
          applicationId,
          actorId: actor.id,
          action: 'CANCEL',
          fromStatus: application.status,
          toStatus: cancelledApplication.status
        });
        db.exec('COMMIT');
        return cancelledApplication;
      } catch (error) {
        if (db.isTransaction) db.exec('ROLLBACK');
        throw error;
      }
    },
    approve(actor, applicationId) {
      const { db } = repo;
      db.exec('BEGIN IMMEDIATE');
      try {
        const { application, event } = managedApplication(actor, applicationId);
        if (application.status !== 'PENDING') throw invalidState();
        if (repo.approvedCount(event.id) >= event.capacity) {
          throw new AppError(409, 'CAPACITY_FULL', '행사 정원이 가득 찼습니다.');
        }

        const approved = repo.setStatus(application.id, 'APPROVED');
        repo.addHistory({
          applicationId: application.id,
          actorId: actor.id,
          action: 'APPROVE',
          fromStatus: application.status,
          toStatus: approved.status
        });
        db.exec('COMMIT');
        return approved;
      } catch (error) {
        if (db.isTransaction) db.exec('ROLLBACK');
        throw error;
      }
    },
    revoke(actor, applicationId, reason) {
      const trimmedReason = typeof reason === 'string' ? reason.trim() : '';
      if (trimmedReason.length < 5 || trimmedReason.length > 200) {
        throw new AppError(400, 'BAD_INPUT', '승인 취소 사유는 5~200자여야 합니다.');
      }

      const { db } = repo;
      db.exec('BEGIN IMMEDIATE');
      try {
        const { application, event } = managedApplication(actor, applicationId);
        if (application.status !== 'APPROVED') throw invalidState();

        const revoked = repo.setStatus(application.id, 'REVOKED');
        const revokeHistoryId = repo.addHistory({
          applicationId: application.id,
          actorId: actor.id,
          action: 'REVOKE',
          fromStatus: application.status,
          toStatus: revoked.status,
          reason: trimmedReason
        });

        const candidate = repo.firstPending(event.id);
        let promoted = null;
        if (candidate) {
          promoted = repo.setStatus(candidate.id, 'APPROVED');
          repo.addHistory({
            applicationId: candidate.id,
            actorId: actor.id,
            action: 'AUTO_APPROVE',
            fromStatus: candidate.status,
            toStatus: promoted.status,
            causeHistoryId: revokeHistoryId
          });
        }

        db.exec('COMMIT');
        return { revoked, promoted };
      } catch (error) {
        if (db.isTransaction) db.exec('ROLLBACK');
        throw error;
      }
    }
  };
}
