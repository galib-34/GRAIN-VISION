import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { RootStackParamList } from './types';
import { BottomTabNavigator } from './BottomTabNavigator';

// Module 1: Auth Screens
import { SplashScreen } from '../screens/auth/SplashScreen';
import { WelcomeScreen } from '../screens/auth/WelcomeScreen';
import { LoginScreen } from '../screens/auth/LoginScreen';
import { RegisterScreen } from '../screens/auth/RegisterScreen';

// Module 2: Home Modals
import { NotificationsModal } from '../screens/home/NotificationsModal';
import { ActivityFeedModal } from '../screens/home/ActivityFeedModal';

// Module 3: AI Quality Inspection Screens
import { CameraCaptureModal } from '../screens/inspection/CameraCaptureModal';
import { ImageValidationModal } from '../screens/inspection/ImageValidationModal';
import { DetectionResultsModal } from '../screens/inspection/DetectionResultsModal';
import { QualitySummaryModal } from '../screens/inspection/QualitySummaryModal';
import { DefectBreakdownModal } from '../screens/inspection/DefectBreakdownModal';
import { ComparisonSliderModal } from '../screens/inspection/ComparisonSliderModal';
import { QualityReportPDFModal } from '../screens/inspection/QualityReportPDFModal';

// Module 4: Seller & Lot Intake Screens
import { SellerSelectionModal } from '../screens/procurement/SellerSelectionModal';
import { AddSellerModal } from '../screens/procurement/AddSellerModal';
import { LotDetailsModal } from '../screens/procurement/LotDetailsModal';
import { LotWeightModal } from '../screens/procurement/LotWeightModal';

// Module 5: Pricing & Negotiation Screens
import { PriceSourceModal } from '../screens/procurement/PriceSourceModal';
import { PriceCalculationModal } from '../screens/procurement/PriceCalculationModal';
import { ReviewNegotiateModal } from '../screens/procurement/ReviewNegotiateModal';
import { ConfirmationModal } from '../screens/procurement/ConfirmationModal';

// Module 7: Transaction Details
import { TransactionDetailsModal } from '../screens/history/TransactionDetailsModal';

// Module 8: Settings
import { ProfileTabScreen } from '../screens/profile/ProfileTabScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

export const RootNavigator: React.FC = () => {
  return (
    <Stack.Navigator
      initialRouteName="AuthSplash"
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
      }}
    >
      {/* Module 1: Splash Screen Initial Route (Hidden Bottom Bar) */}
      <Stack.Screen name="AuthSplash" component={SplashScreen} />

      {/* Main Tabs Container - Bottom Tab Bar is visible ONLY here */}
      <Stack.Screen name="MainTabs" component={BottomTabNavigator} />

      {/* Module 1: Authentication Flow (Hidden Bottom Bar) */}
      <Stack.Group screenOptions={{ animation: 'fade' }}>
        <Stack.Screen name="AuthWelcome" component={WelcomeScreen} />
        <Stack.Screen name="AuthLogin" component={LoginScreen} />
        <Stack.Screen name="AuthRegister" component={RegisterScreen} />
      </Stack.Group>

      {/* Module 3: AI Quality Inspection Step-by-Step Flow (Hidden Bottom Bar) */}
      <Stack.Group screenOptions={{ animation: 'slide_from_bottom' }}>
        <Stack.Screen name="CameraCaptureModal" component={CameraCaptureModal} />
        <Stack.Screen name="ImageValidationModal" component={ImageValidationModal} />
        <Stack.Screen name="DetectionResultsModal" component={DetectionResultsModal} />
        <Stack.Screen name="QualitySummaryModal" component={QualitySummaryModal} />
        <Stack.Screen name="DefectBreakdownModal" component={DefectBreakdownModal} />
        <Stack.Screen name="ComparisonSliderModal" component={ComparisonSliderModal} />
        <Stack.Screen name="QualityReportPDFModal" component={QualityReportPDFModal} />
      </Stack.Group>

      {/* Module 4: Seller & Lot Intake Flow (Hidden Bottom Bar) */}
      <Stack.Group screenOptions={{ presentation: 'modal' }}>
        <Stack.Screen name="SellerSelectionModal" component={SellerSelectionModal} />
        <Stack.Screen name="AddSellerModal" component={AddSellerModal} />
        <Stack.Screen name="LotDetailsModal" component={LotDetailsModal} />
        <Stack.Screen name="LotWeightModal" component={LotWeightModal} />
      </Stack.Group>

      {/* Module 5: Pricing & Negotiation Engine (Hidden Bottom Bar) */}
      <Stack.Group screenOptions={{ presentation: 'modal' }}>
        <Stack.Screen name="PricingModal" component={PriceSourceModal} />
        <Stack.Screen name="PriceSourceModal" component={PriceSourceModal} />
        <Stack.Screen name="PriceCalculationModal" component={PriceCalculationModal} />
        <Stack.Screen name="ReviewNegotiateModal" component={ReviewNegotiateModal} />
        <Stack.Screen name="ConfirmationModal" component={ConfirmationModal} />
      </Stack.Group>

      {/* Detail Modals & Feeds (Hidden Bottom Bar) */}
      <Stack.Group screenOptions={{ presentation: 'card' }}>
        <Stack.Screen name="TransactionDetailsModal" component={TransactionDetailsModal} />
        <Stack.Screen name="NotificationsModal" component={NotificationsModal} />
        <Stack.Screen name="ActivityFeedModal" component={ActivityFeedModal} />
        <Stack.Screen name="SettingsModal" component={ProfileTabScreen} />
      </Stack.Group>
    </Stack.Navigator>
  );
};
