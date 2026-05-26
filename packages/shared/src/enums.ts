export enum UserRole {
  Admin = "ADMIN",
  Actor = "ACTOR",
  Client = "CLIENT",
  Agency = "AGENCY",
}

export enum ActorProfileStatus {
  Draft = "DRAFT",
  PendingReview = "PENDING_REVIEW",
  Approved = "APPROVED",
  Rejected = "REJECTED",
  Suspended = "SUSPENDED",
}

export enum SkillCategory {
  Acting = "ACTING",
  Voice = "VOICE",
  Singing = "SINGING",
  Dance = "DANCE",
  MartialArts = "MARTIAL_ARTS",
  Stunts = "STUNTS",
  Sports = "SPORTS",
  Comedy = "COMEDY",
  Drama = "DRAMA",
  UgcAds = "UGC_ADS",
  Corporate = "CORPORATE",
  BodyMovement = "BODY_MOVEMENT",
  EmotionalPerformance = "EMOTIONAL_PERFORMANCE",
}

export enum VideoType {
  Intro = "INTRO",
  ActingTest = "ACTING_TEST",
  MotionTest = "MOTION_TEST",
  VoiceSample = "VOICE_SAMPLE",
  Portfolio = "PORTFOLIO",
  BeforeAfterAi = "BEFORE_AFTER_AI",
}

export enum Visibility {
  Public = "PUBLIC",
  Private = "PRIVATE",
  Unlisted = "UNLISTED",
}

export enum AgencyRequestStatus {
  New = "NEW",
  Contacted = "CONTACTED",
  Approved = "APPROVED",
  Rejected = "REJECTED",
}
