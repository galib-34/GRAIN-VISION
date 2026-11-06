import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';

interface Props {
  title?: string;
  subtitle?: string;
  actionText?: string;
  onAction?: () => void;
}

export const PlaceholderScreen: React.FC<Props> = ({
  title,
  subtitle,
  actionText,
  onAction,
}) => {
  const navigation = useNavigation<any>();
  const route = useRoute();
  const screenName = title || route.name;

  return (
    <View className="flex-1 bg-slate-50 items-center justify-center p-6">
      <View className="w-16 h-16 rounded-2xl bg-emerald-100 items-center justify-center mb-4 border border-emerald-300">
        <Text className="text-2xl">🌾</Text>
      </View>
      <Text className="text-xl font-bold text-slate-800 text-center mb-2">{screenName}</Text>
      <Text className="text-sm text-slate-500 text-center mb-6">
        {subtitle || 'Screen architecture initialized. Component layout pending Phase 2 build.'}
      </Text>

      {actionText && (
        <TouchableOpacity
          onPress={onAction || (() => navigation.goBack())}
          className="bg-emerald-600 px-6 py-3 rounded-xl shadow-sm active:scale-95"
        >
          <Text className="text-white font-semibold text-sm">{actionText}</Text>
        </TouchableOpacity>
      )}

      {navigation.canGoBack() && !actionText && (
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          className="bg-slate-200 px-5 py-2.5 rounded-lg active:scale-95"
        >
          <Text className="text-slate-700 font-medium text-xs">← Back</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};
