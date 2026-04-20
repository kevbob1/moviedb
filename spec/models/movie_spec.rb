# frozen_string_literal: true

require "rails_helper"

RSpec.describe Movie, type: :model do
  # ── Shoulda-matchers one-liners ──────────────────────────────────────

  describe "validations (shoulda-matchers)" do
    it { is_expected.to validate_presence_of(:title) }

    # validate_uniqueness_of needs an existing record in the database so
    # the matcher can attempt a duplicate.  We use `subject` with a
    # persisted record to satisfy that requirement.
    describe "tmdb_id uniqueness" do
      subject { build(:movie, tmdb_id: 12345) }

      it { is_expected.to validate_uniqueness_of(:tmdb_id).allow_nil }
    end
  end

  # ── Factory sanity ───────────────────────────────────────────────────

  describe "factory" do
    it "is valid with all default attributes" do
      movie = build(:movie)
      expect(movie).to be_valid
    end
  end

  # ── Presence / nil-ability ───────────────────────────────────────────

  describe "title" do
    it "is invalid without a title", :aggregate_failures do
      movie = build(:movie, title: nil)
      expect(movie).not_to be_valid
      expect(movie.errors[:title]).to include("can't be blank")
    end
  end

  describe "release_date" do
    it "is invalid with a non-integer release_date", :aggregate_failures do
      movie = build(:movie, release_date: 19.99)
      expect(movie).not_to be_valid
      expect(movie.errors[:release_date]).to include("must be an integer")
    end

    it "is valid without a release_date (nil allowed)" do
      movie = build(:movie, release_date: nil)
      expect(movie).to be_valid
    end
  end

  describe "description" do
    it "is valid without a description (nil allowed)" do
      movie = build(:movie, description: nil)
      expect(movie).to be_valid
    end
  end

  # ── tmdb_id uniqueness edge cases ───────────────────────────────────

  describe "tmdb_id" do
    it "is invalid when two movies share the same non-nil tmdb_id", :aggregate_failures do
      create(:movie, tmdb_id: 550)
      duplicate = build(:movie, tmdb_id: 550)
      expect(duplicate).not_to be_valid
      expect(duplicate.errors[:tmdb_id]).to include("has already been taken")
    end

    it "allows multiple movies with nil tmdb_id" do
      create(:movie, tmdb_id: nil)
      second = build(:movie, tmdb_id: nil)
      expect(second).to be_valid
    end
  end

  # ── Attribute read/write ────────────────────────────────────────────

  describe "attribute accessors" do
    it "reads and writes title, description, and release_date", :aggregate_failures do
      movie = described_class.new
      movie.title = "Test Movie"
      movie.description = "A test description"
      movie.release_date = 2024

      expect(movie.title).to eq("Test Movie")
      expect(movie.description).to eq("A test description")
      expect(movie.release_date).to eq(2024)
    end
  end
end
