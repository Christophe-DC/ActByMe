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

export enum PerformancePath {
  Self = "SELF",
  TeamMember = "TEAM_MEMBER",
  ActByMePerformer = "ACTBYME_PERFORMER",
}

export enum PerformanceWorkflowStatus {
  Draft = "DRAFT",
  ReadyForBrief = "READY_FOR_BRIEF",
  GeneratingBrief = "GENERATING_BRIEF",
  BriefReview = "BRIEF_REVIEW",
  BriefApproved = "BRIEF_APPROVED",
  PerformerSelection = "PERFORMER_SELECTION",
  CompanyDetails = "COMPANY_DETAILS",
  ProjectDetails = "PROJECT_DETAILS",
  SetupReview = "SETUP_REVIEW",
  BriefProcessing = "BRIEF_PROCESSING",
  BriefReady = "BRIEF_READY",
  PerformanceSource = "PERFORMANCE_SOURCE",
  ActorSelection = "ACTOR_SELECTION",
  RequestSummary = "REQUEST_SUMMARY",
  PerformanceProgress = "PERFORMANCE_PROGRESS",
  QaPending = "QA_PENDING",
  ClientReview = "CLIENT_REVIEW",
  ApprovedDelivery = "APPROVED_DELIVERY",
}

export enum PerformanceTakeUploadStatus {
  Uploading = "UPLOADING",
  Uploaded = "UPLOADED",
  Failed = "FAILED",
}

export enum PerformanceTakeStatus {
  Draft = "DRAFT",
  Submitted = "SUBMITTED",
  QaRunning = "QA_RUNNING",
  QaFailed = "QA_FAILED",
  QaPassed = "QA_PASSED",
  Approved = "APPROVED",
}

export enum PerformanceQaRunStatus {
  Running = "RUNNING",
  Completed = "COMPLETED",
  Error = "ERROR",
}

export enum PerformanceQaResultStatus {
  Pass = "PASS",
  Fail = "FAIL",
}

export enum PerformanceQaCheckType {
  FileCodec = "FILE_CODEC",
  Duration = "DURATION",
  ResolutionOrientation = "RESOLUTION_ORIENTATION",
  AudioPresence = "AUDIO_PRESENCE",
  DialogueAccuracy = "DIALOGUE_ACCURACY",
}

export enum PerformanceBriefAttachmentStatus {
  Uploading = "UPLOADING",
  Parsing = "PARSING",
  Ready = "READY",
  Failed = "FAILED",
}
