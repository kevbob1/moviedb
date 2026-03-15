class Movie < ApplicationRecord
  validates :title, presence: true
  validates :release_date, numericality: { only_integer: true }, allow_nil: true
  validates :tmdb_id, uniqueness: true, allow_nil: true

  before_update :snapshot_before_state
  after_create :publish_audit_created
  after_update :publish_audit_updated
  after_destroy :publish_audit_destroyed

  private

  def snapshot_before_state
    @audit_before = attributes.deep_dup
  end

  def publish_audit_created
    audit_service.publish_audit(action: :created, record_id: id, before: nil, after: attributes)
  rescue StandardError => e
    Rails.logger.error("Audit callback failed for movie #{id}: #{e.message}")
  end

  def publish_audit_updated
    audit_service.publish_audit(action: :updated, record_id: id, before: @audit_before, after: attributes)
  rescue StandardError => e
    Rails.logger.error("Audit callback failed for movie #{id}: #{e.message}")
  end

  def publish_audit_destroyed
    audit_service.publish_audit(action: :destroyed, record_id: id, before: attributes, after: nil)
  rescue StandardError => e
    Rails.logger.error("Audit callback failed for movie #{id}: #{e.message}")
  end

  def audit_service
    @audit_service ||= MovieAuditService.new
  end
end
