import React from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';

interface NotificationItem {
  id: string;
  title: string;
  message: string;
  time: string;
  type: 'price' | 'alert' | 'lot';
  read: boolean;
}

const MOCK_NOTIFICATIONS: NotificationItem[] = [
  {
    id: 'n-1',
    title: 'Mandi Rate Updated',
    message: 'AGMARKNET daily modal price for Paddy in Kakinada Yard updated to ₹2,320 / quintal.',
    time: '2 hours ago',
    type: 'price',
    read: false,
  },
  {
    id: 'n-2',
    title: 'High Moisture Warning',
    message: 'Lot LOT-20261024-C341 recorded 17.5% moisture content (standard threshold is 14%).',
    time: 'Yesterday',
    type: 'alert',
    read: false,
  },
  {
    id: 'n-3',
    title: 'Procurement Lot Approved',
    message: 'Lot LOT-20261025-A104 for Ramesh Naidu (850 kg) accepted for milling intake.',
    time: '2 days ago',
    type: 'lot',
    read: true,
  },
];

export const NotificationsModal: React.FC = () => {
  const navigation = useNavigation();

  return (
    <View className="flex-1 bg-white">
      {/* Top Header */}
      <View className="pt-14 pb-4 px-5 bg-slate-50 border-b border-slate-200 flex-row items-center justify-between">
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          className="w-10 h-10 rounded-full bg-white items-center justify-center border border-slate-200 active:scale-95"
        >
          <Text className="text-slate-700 text-lg">←</Text>
        </TouchableOpacity>
        <Text className="text-base font-black text-slate-800">Notifications</Text>
        <TouchableOpacity>
          <Text className="text-xs font-bold text-brand-600">Mark read</Text>
        </TouchableOpacity>
      </View>

      <ScrollView className="flex-1 p-5 space-y-3">
        {MOCK_NOTIFICATIONS.map((item) => (
          <View
            key={item.id}
            className={`p-4 rounded-2xl border ${item.read ? 'bg-white border-slate-200' : 'bg-emerald-50/60 border-emerald-200'} shadow-sm`}
          >
            <View className="flex-row items-center justify-between mb-1.5">
              <View className="flex-row items-center space-x-2">
                <Text className="text-sm">
                  {item.type === 'price' ? '📈' : item.type === 'alert' ? '⚠️' : '✅'}
                </Text>
                <Text className="text-xs font-bold text-slate-900">{item.title}</Text>
              </View>
              <Text className="text-[10px] text-slate-400">{item.time}</Text>
            </View>
            <Text className="text-xs text-slate-600 leading-relaxed">
              {item.message}
            </Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
};
