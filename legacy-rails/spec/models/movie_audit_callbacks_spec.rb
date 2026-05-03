# frozen_string_literal: true

require "rails_helper"

RSpec.describe Movie, type: :model do
  let(:audit_service) { instance_double(MovieAuditService, publish_audit: nil) }

  before do
    allow(MovieAuditService).to receive(:new).and_return(audit_service)
  end

  describe "audit callbacks" do
    describe "after_create" do
    it "publishes movie.created with before nil and after containing attributes" do
      movie = create(:movie)

      expect(audit_service).to have_received(:publish_audit).with(
        action: :created,
        record_id: movie.id,
        before: nil,
        after: hash_including("title" => movie.title, "id" => movie.id)
      )
    end
  end

  describe "before_update / after_update" do
    it "captures snapshot and publishes movie.updated with both before and after" do
      movie = create(:movie, title: "Original Title")

      movie.update!(title: "Updated Title")

      expect(audit_service).to have_received(:publish_audit).with(
        action: :updated,
        record_id: movie.id,
        before: a_hash_including("id" => movie.id),
        after: hash_including("title" => "Updated Title")
      )
    end

    it "includes before and after hashes that are both present" do
      movie = create(:movie, title: "Original Title")

      movie.update!(title: "Updated Title")

      expect(audit_service).to have_received(:publish_audit).with(
        hash_including(
          action: :updated,
          before: a_hash_including("id" => movie.id),
          after: hash_including("title" => "Updated Title")
        )
      )
    end
  end

  describe "after_destroy" do
    it "publishes movie.destroyed with after nil" do
      movie = create(:movie)
      saved_title = movie.title

      movie.destroy!

      expect(audit_service).to have_received(:publish_audit).with(
        action: :destroyed,
        record_id: movie.id,
        before: hash_including("title" => saved_title),
        after: nil
      )
    end
  end

  describe "exception handling" do
    it "swallows exceptions from audit service without breaking the save" do
      allow(audit_service).to receive(:publish_audit).and_raise(StandardError.new("Kafka down"))
      allow(Rails.logger).to receive(:error)

      expect {
        create(:movie)
      }.to change(described_class, :count).by(1)
    end
  end

  describe "validation failure" do
    it "does not publish audit when create fails validation" do
      movie = described_class.new(title: "", description: "No title")
      movie.save

      expect(audit_service).not_to have_received(:publish_audit)
    end
    end
  end
end
