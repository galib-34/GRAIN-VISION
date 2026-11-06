import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, Text } from 'react-native';
import { MainTabParamList } from './types';
import { HomeTabScreen } from '../screens/home/HomeTabScreen';
import { AnalyzeLandingScreen } from '../screens/inspection/AnalyzeLandingScreen';
import { LotsTabScreen } from '../screens/lots/LotsTabScreen';
import { HistoryTabScreen } from '../screens/history/HistoryTabScreen';
import { ProfileTabScreen } from '../screens/profile/ProfileTabScreen';

const Tab = createBottomTabNavigator<MainTabParamList>();

const TabIcon = ({ name, focused }: { name: string; focused: boolean }) => {
  const getEmoji = () => {
    switch (name) {
      case 'Home': return '🏠';
      case 'Analyze': return '📷';
      case 'Lots': return '📦';
      case 'History': return '📜';
      case 'Profile': return '👤';
      default: return '🌾';
    }
  };

  return (
    <View className={`items-center justify-center ${name === 'Analyze' ? 'w-12 h-12 rounded-full bg-emerald-600 -mt-5 shadow-lg shadow-emerald-900/30' : ''}`}>
      <Text className={name === 'Analyze' ? 'text-xl' : 'text-lg'}>{getEmoji()}</Text>
    </View>
  );
};

export const BottomTabNavigator: React.FC = () => {
  return (
    <Tab.Navigator
      initialRouteName="HomeTab"
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#059669',
        tabBarInactiveTintColor: '#64748b',
        tabBarStyle: {
          backgroundColor: '#ffffff',
          borderTopColor: '#e2e8f0',
          borderTopWidth: 1,
          height: 64,
          paddingBottom: 8,
          paddingTop: 6,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
      }}
    >
      <Tab.Screen
        name="HomeTab"
        component={HomeTabScreen}
        options={{
          tabBarLabel: 'Home',
          tabBarIcon: ({ focused }) => <TabIcon name="Home" focused={focused} />,
        }}
      />
      <Tab.Screen
        name="AnalyzeTab"
        component={AnalyzeLandingScreen}
        options={{
          tabBarLabel: 'Analyze',
          tabBarIcon: ({ focused }) => <TabIcon name="Analyze" focused={focused} />,
        }}
      />
      <Tab.Screen
        name="LotsTab"
        component={LotsTabScreen}
        options={{
          tabBarLabel: 'Lots',
          tabBarIcon: ({ focused }) => <TabIcon name="Lots" focused={focused} />,
        }}
      />
      <Tab.Screen
        name="HistoryTab"
        component={HistoryTabScreen}
        options={{
          tabBarLabel: 'History',
          tabBarIcon: ({ focused }) => <TabIcon name="History" focused={focused} />,
        }}
      />
      <Tab.Screen
        name="ProfileTab"
        component={ProfileTabScreen}
        options={{
          tabBarLabel: 'Profile',
          tabBarIcon: ({ focused }) => <TabIcon name="Profile" focused={focused} />,
        }}
      />
    </Tab.Navigator>
  );
};
