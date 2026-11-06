import { NavigatorScreenParams } from '@react-navigation/native';

export type MainTabParamList = {
  HomeTab: undefined;
  AnalyzeTab: undefined;
  LotsTab: undefined;
  HistoryTab: undefined;
  ProfileTab: undefined;
};

export type RootStackParamList = {
  MainTabs: NavigatorScreenParams<MainTabParamList>;

  // Authentication Flow (Modal / Stack - No Bottom Bar)
  AuthSplash: undefined;
  AuthWelcome: undefined;
  AuthLogin: undefined;
  AuthRegister: undefined;

  // AI Quality Inspection Workflow (Step-by-Step - No Bottom Bar)
  CameraCaptureModal: undefined;
  ImageValidationModal: undefined;
  DetectionResultsModal: undefined;
  QualitySummaryModal: undefined;
  DefectBreakdownModal: undefined;
  ComparisonSliderModal: undefined;
  QualityReportPDFModal: undefined;

  // Seller & Lot Setup Workflow (No Bottom Bar)
  SellerSelectionModal: undefined;
  AddSellerModal: undefined;
  LotDetailsModal: undefined;
  LotWeightModal: undefined;

  // Pricing & Negotiation Workflow (No Bottom Bar)
  PricingModal: undefined; // Alias to PriceSourceModal
  PriceSourceModal: undefined;
  PriceCalculationModal: undefined;
  ReviewNegotiateModal: undefined;
  ConfirmationModal: undefined;

  // Details & Feeds (No Bottom Bar)
  TransactionDetailsModal: { lotId: string };
  NotificationsModal: undefined;
  ActivityFeedModal: undefined;
  SettingsModal: undefined;
};
