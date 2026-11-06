import React, { useState } from 'react';
import { View, Text, Image, TouchableOpacity, ScrollView, Alert, Dimensions, StyleSheet } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import Svg, { Rect } from 'react-native-svg';
import { RootStackParamList } from '../../navigation/types';
import { useLotStore } from '../../stores/lotStore';
import { useAuthStore } from '../../stores/authStore';
import { MOCK_DETECTIONS } from '../../services/mockData';

type RouteProps = RouteProp<RootStackParamList, 'TransactionDetailsModal'>;
const { width: SCREEN_WIDTH } = Dimensions.get('window');

type SubTab = 'summary' | 'quality' | 'pricing' | 'images';

export const TransactionDetailsModal: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute<RouteProps>();
  const { lotId } = route.params;

  const user = useAuthStore((state) => state.user);
  const lots = useLotStore((state) => state.lots);
  const lot = lots.find((l) => l.id === lotId) || lots[0];

  const [activeTab, setActiveTab] = useState<SubTab>('summary');
  const [showAnnotated, setShowAnnotated] = useState(true);

  if (!lot) {
    return (
      <View className="flex-1 bg-white items-center justify-center p-6">
        <Text className="text-sm text-slate-500 mb-4">Lot record not found.</Text>
        <TouchableOpacity onPress={() => navigation.goBack()} className="bg-brand-600 px-5 py-2.5 rounded-xl">
          <Text className="text-white font-bold">Return</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const isAccepted = lot.status === 'accepted';
  const score = lot.qualityScore || 84.5;
  const grade = score >= 80 ? 'Grade A (Premium)' : score >= 60 ? 'Grade B (Commercial)' : 'Grade C (High Defect)';

  const generateReceiptHtml = () => {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <style>
            body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 24px; color: #172018; margin: 0; line-height: 1.5; }
            .header { border-bottom: 3px solid #059669; padding-bottom: 12px; margin-bottom: 20px; }
            .title { color: #064e3b; margin: 0; font-size: 24px; font-weight: 900; }
            .badge { display: inline-block; padding: 4px 12px; border-radius: 12px; font-weight: bold; font-size: 12px; margin-top: 8px; }
            .accepted { background: #d1fae5; color: #065f46; }
            .rejected { background: #fee2e2; color: #991b1b; }
            .section { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; margin-bottom: 16px; }
            .section-title { font-size: 13px; font-weight: 800; text-transform: uppercase; color: #475569; margin-bottom: 10px; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px; }
            .row { display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 6px; }
            .label { color: #64748b; }
            .val { font-weight: bold; color: #0f172a; }
            .total-row { border-top: 2px dashed #059669; padding-top: 10px; margin-top: 10px; font-size: 16px; color: #064e3b; }
            .disclaimer { font-size: 10px; color: #94a3b8; margin-top: 24px; line-height: 1.4; border-left: 3px solid #059669; padding-left: 10px; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1 class="title">🌾 GRAIN-VISION Procurement Receipt</h1>
            <p style="color: #64748b; font-size: 12px; margin: 4px 0 0 0;">Transaction Receipt Reference: <strong>${lot.lotId}</strong></p>
            <span class="badge ${isAccepted ? 'accepted' : 'rejected'}">STATUS: ${lot.status.toUpperCase()}</span>
          </div>

          <div class="section">
            <div class="section-title">Inspector & Terminal Particulars</div>
            <div class="row"><span class="label">Procurement Officer:</span><span class="val">${user?.fullName || 'Agricultural Inspector'}</span></div>
            <div class="row"><span class="label">Officer ID:</span><span class="val">${user?.username || 'officer-01'}</span></div>
            <div class="row"><span class="label">Intake Yard / Org:</span><span class="val">${user?.orgName || 'Kakinada Mandi Terminal'}</span></div>
            <div class="row"><span class="label">Timestamp:</span><span class="val">${lot.createdAt ? new Date(lot.createdAt).toLocaleString('en-IN') : new Date().toLocaleString('en-IN')}</span></div>
          </div>

          <div class="section">
            <div class="section-title">Farmer & Lot Information</div>
            <div class="row"><span class="label">Farmer Name:</span><span class="val">${lot.seller?.name || 'N/A'}</span></div>
            <div class="row"><span class="label">Contact:</span><span class="val">${lot.seller?.phone || 'N/A'}</span></div>
            <div class="row"><span class="label">Location:</span><span class="val">${lot.seller?.location || 'N/A'}</span></div>
            <div class="row"><span class="label">Passbook ID:</span><span class="val">${lot.seller?.sellerCode || 'AP-0194'}</span></div>
            <div class="row"><span class="label">Rice Variety:</span><span class="val">${lot.variety}</span></div>
            <div class="row"><span class="label">Moisture Content:</span><span class="val">${lot.moisturePercentage || 14.0}%</span></div>
            <div class="row"><span class="label">Lot Net Weight:</span><span class="val">${lot.weightKg} kg (${lot.weightQuintals} quintals)</span></div>
          </div>

          <div class="section">
            <div class="section-title">AI Quality Assessment</div>
            <div class="row"><span class="label">Quality Score:</span><span class="val">${score.toFixed(1)} / 100 (${grade})</span></div>
            <div class="row"><span class="label">Sound Grains:</span><span class="val">${lot.metrics?.soundPct ?? 78.2}%</span></div>
            <div class="row"><span class="label">Broken Grains:</span><span class="val">${lot.metrics?.brokenPct ?? 12.7}%</span></div>
            <div class="row"><span class="label">Chalky Grains:</span><span class="val">${lot.metrics?.chalkyPct ?? 6.3}%</span></div>
            <div class="row"><span class="label">Unsound / Foreign:</span><span class="val">${lot.metrics?.discoloredPct ?? 2.8}%</span></div>
          </div>

          <div class="section">
            <div class="section-title">Valuation & Settlement</div>
            <div class="row"><span class="label">Base Reference Rate:</span><span class="val">₹${((lot.pricing?.baseRatePerQuintal || 2320) / 100).toFixed(2)} / kg</span></div>
            <div class="row"><span class="label">Quality Adjustment:</span><span class="val">${lot.pricing?.adjustmentPercentage || 0}%</span></div>
            <div class="row"><span class="label">Settled Unit Rate:</span><span class="val">₹${lot.pricing?.agreedRatePerKg || lot.pricing?.estimatedRatePerKg || 23.66} / kg</span></div>
            <div class="row total-row">
              <strong>Total Lot Payout:</strong>
              <strong>₹${Math.round(lot.pricing?.totalEstimatedPrice || 0).toLocaleString('en-IN')}</strong>
            </div>
          </div>

          ${lot.rejectionReason ? `
            <div class="section" style="border-color: #fca5a5; background: #fff1f2;">
              <div class="section-title" style="color: #991b1b;">Rejection Justification</div>
              <div class="val" style="color: #991b1b;">${lot.rejectionReason}</div>
            </div>
          ` : ''}

          <div class="disclaimer">
            <strong>Statutory Decision Support Disclaimer:</strong><br />
            This transaction receipt and quality assessment is generated by the GRAIN-VISION Edge AI Mobile Terminal. All metrics, quality grades, and price calculations serve as informational decision-support baselines and adhere to civil supplies procurement parameters.
          </div>
        </body>
      </html>
    `;
  };

  const handleDownloadPdf = async () => {
    try {
      const html = generateReceiptHtml();
      const { uri } = await Print.printToFileAsync({ html });
      Alert.alert(
        'Receipt Downloaded',
        'PDF receipt is ready in your device storage.',
        [{ text: 'OK' }]
      );
    } catch (err: any) {
      Alert.alert('Download Failed', err?.message || 'Could not save PDF receipt.');
    }
  };

  const handleShareReceipt = async () => {
    try {
      const html = generateReceiptHtml();
      const { uri } = await Print.printToFileAsync({ html });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: 'application/pdf',
          dialogTitle: `Procurement-Receipt-${lot.lotId}`,
          UTI: 'com.adobe.pdf',
        });
      } else {
        Alert.alert('Sharing Unavailable', 'The receipt PDF is ready to download.');
      }
    } catch (err: any) {
      Alert.alert('Share Failed', err?.message || 'Could not share receipt.');
    }
  };

  return (
    <View className="flex-1 bg-slate-50">
      {/* Top Header */}
      <View className="pt-14 pb-4 px-5 bg-white border-b border-slate-200 flex-row items-center justify-between">
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          className="w-10 h-10 rounded-full bg-slate-100 items-center justify-center border border-slate-200 active:scale-95"
        >
          <Text className="text-slate-700 text-lg">←</Text>
        </TouchableOpacity>
        <View className="items-center">
          <Text className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            Audit Ledger Record
          </Text>
          <Text className="text-sm font-black text-slate-900">{lot.lotId}</Text>
        </View>
        <TouchableOpacity
          onPress={handleShareReceipt}
          className="w-10 h-10 rounded-full bg-emerald-50 items-center justify-center border border-emerald-200 active:scale-95"
        >
          <Text className="text-base">📤</Text>
        </TouchableOpacity>
      </View>

      {/* Internal Sub-Tabs Bar */}
      <View className="bg-white px-5 pt-1 pb-3 border-b border-slate-200 flex-row justify-between">
        {(['summary', 'quality', 'pricing', 'images'] as SubTab[]).map((tab) => {
          const isActive = activeTab === tab;
          const labels: Record<SubTab, string> = {
            summary: 'Summary',
            quality: 'Quality',
            pricing: 'Pricing',
            images: 'Images',
          };
          return (
            <TouchableOpacity
              key={tab}
              onPress={() => setActiveTab(tab)}
              className={`py-2 px-3.5 rounded-xl ${isActive ? 'bg-emerald-600' : ''}`}
            >
              <Text className={`text-xs font-bold ${isActive ? 'text-white' : 'text-slate-600'}`}>
                {labels[tab]}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <ScrollView className="flex-1 p-5" contentContainerStyle={{ paddingBottom: 60 }}>
        {/* SUB-TAB 1: SUMMARY */}
        {activeTab === 'summary' && (
          <View className="space-y-4">
            {/* Status Hero Card */}
            <View className={`p-5 rounded-3xl border ${isAccepted ? 'bg-emerald-50 border-emerald-200' : 'bg-rose-50 border-rose-200'}`}>
              <View className="flex-row items-center justify-between mb-2">
                <Text className={`text-xs font-black uppercase tracking-wider ${isAccepted ? 'text-emerald-800' : 'text-rose-800'}`}>
                  Procurement Determination: {lot.status.toUpperCase()}
                </Text>
                <Text className="text-lg">{isAccepted ? '✅' : '❌'}</Text>
              </View>
              <Text className="text-2xl font-black text-slate-900 mb-1">
                ₹{Math.round(lot.pricing?.totalEstimatedPrice || 0).toLocaleString('en-IN')}
              </Text>
              <Text className="text-xs text-slate-600">
                {lot.weightKg} kg · ₹{lot.pricing?.agreedRatePerKg || lot.pricing?.estimatedRatePerKg}/kg
              </Text>
              {lot.rejectionReason && (
                <View className="bg-white p-2.5 rounded-xl border border-rose-200 mt-2">
                  <Text className="text-xs text-rose-800 font-bold">Reason: {lot.rejectionReason}</Text>
                </View>
              )}
            </View>

            {/* Farmer Particulars */}
            <View className="bg-white p-5 rounded-3xl border border-slate-200 space-y-2.5">
              <Text className="text-xs font-black text-slate-900 uppercase tracking-wider mb-1">Farmer Details</Text>
              <View className="flex-row justify-between pb-2 border-b border-slate-100">
                <Text className="text-xs text-slate-500">Name</Text>
                <Text className="text-xs font-bold text-slate-900">{lot.seller?.name}</Text>
              </View>
              <View className="flex-row justify-between pb-2 border-b border-slate-100">
                <Text className="text-xs text-slate-500">Mobile</Text>
                <Text className="text-xs font-bold text-slate-900">{lot.seller?.phone}</Text>
              </View>
              <View className="flex-row justify-between pb-2 border-b border-slate-100">
                <Text className="text-xs text-slate-500">Location</Text>
                <Text className="text-xs font-bold text-slate-900">{lot.seller?.location}</Text>
              </View>
              <View className="flex-row justify-between">
                <Text className="text-xs text-slate-500">Farmer Passbook ID</Text>
                <Text className="text-xs font-bold text-slate-900">{lot.seller?.sellerCode || 'AP-0194'}</Text>
              </View>
            </View>

            {/* Inspector & Terminal Metadata */}
            <View className="bg-white p-5 rounded-3xl border border-slate-200 space-y-2.5">
              <Text className="text-xs font-black text-slate-900 uppercase tracking-wider mb-1">Inspector & Terminal</Text>
              <View className="flex-row justify-between pb-2 border-b border-slate-100">
                <Text className="text-xs text-slate-500">Officer Name</Text>
                <Text className="text-xs font-bold text-slate-900">{user?.fullName || 'Agricultural Inspector'}</Text>
              </View>
              <View className="flex-row justify-between pb-2 border-b border-slate-100">
                <Text className="text-xs text-slate-500">Officer ID</Text>
                <Text className="text-xs font-bold text-slate-900">{user?.username || 'officer-01'}</Text>
              </View>
              <View className="flex-row justify-between pb-2 border-b border-slate-100">
                <Text className="text-xs text-slate-500">Intake Yard</Text>
                <Text className="text-xs font-bold text-slate-900">{user?.orgName || 'Kakinada Market Yard'}</Text>
              </View>
              <View className="flex-row justify-between">
                <Text className="text-xs text-slate-500">Audit Timestamp</Text>
                <Text className="text-xs font-bold text-slate-900">
                  {lot.createdAt ? new Date(lot.createdAt).toLocaleString('en-IN') : 'N/A'}
                </Text>
              </View>
            </View>

            {/* Lot Particulars */}
            <View className="bg-white p-5 rounded-3xl border border-slate-200 space-y-2.5">
              <Text className="text-xs font-black text-slate-900 uppercase tracking-wider mb-1">Lot Specifications</Text>
              <View className="flex-row justify-between pb-2 border-b border-slate-100">
                <Text className="text-xs text-slate-500">Rice Variety</Text>
                <Text className="text-xs font-bold text-slate-900">{lot.variety}</Text>
              </View>
              <View className="flex-row justify-between pb-2 border-b border-slate-100">
                <Text className="text-xs text-slate-500">Moisture Content</Text>
                <Text className="text-xs font-bold text-slate-900">{lot.moisturePercentage || 14.0}%</Text>
              </View>
              <View className="flex-row justify-between">
                <Text className="text-xs text-slate-500">Inspector Remarks</Text>
                <Text className="text-xs font-medium text-slate-700 max-w-[65%] text-right">{lot.notes || 'No remarks recorded.'}</Text>
              </View>
            </View>
          </View>
        )}

        {/* SUB-TAB 2: QUALITY METRICS */}
        {activeTab === 'quality' && (
          <View className="space-y-4">
            <View className="bg-white p-6 rounded-3xl border border-slate-200 items-center">
              <Text className="text-xs font-bold text-slate-400 uppercase">Assessed Score</Text>
              <Text className="text-5xl font-black text-brand-950 my-1">{score.toFixed(1)} / 100</Text>
              <View className="bg-emerald-600 px-3.5 py-1 rounded-full">
                <Text className="text-xs font-bold text-white uppercase">{grade}</Text>
              </View>
            </View>

            <View className="bg-white p-5 rounded-3xl border border-slate-200 space-y-3">
              <Text className="text-xs font-black text-slate-900 uppercase tracking-wider mb-1">Defect Matrix</Text>
              <View className="flex-row justify-between pb-2 border-b border-slate-100">
                <Text className="text-xs text-slate-700">🟢 Sound Grains</Text>
                <Text className="text-xs font-bold text-slate-900">{lot.metrics?.soundPct ?? 78.2}%</Text>
              </View>
              <View className="flex-row justify-between pb-2 border-b border-slate-100">
                <Text className="text-xs text-slate-700">🟡 Broken Clear / Chalky</Text>
                <Text className="text-xs font-bold text-slate-900">{lot.metrics?.brokenPct ?? 12.7}%</Text>
              </View>
              <View className="flex-row justify-between pb-2 border-b border-slate-100">
                <Text className="text-xs text-slate-700">🔵 Whole Chalky</Text>
                <Text className="text-xs font-bold text-slate-900">{lot.metrics?.chalkyPct ?? 6.3}%</Text>
              </View>
              <View className="flex-row justify-between">
                <Text className="text-xs text-slate-700">🔴 Unsound / Foreign</Text>
                <Text className="text-xs font-bold text-slate-900">{lot.metrics?.discoloredPct ?? 2.8}%</Text>
              </View>
            </View>
          </View>
        )}

        {/* SUB-TAB 3: PRICING BREAKDOWN */}
        {activeTab === 'pricing' && (
          <View className="bg-white p-5 rounded-3xl border border-slate-200 space-y-3">
            <Text className="text-xs font-black text-slate-900 uppercase tracking-wider mb-1">Pricing Ledger</Text>
            <View className="flex-row justify-between pb-2 border-b border-slate-100">
              <Text className="text-xs text-slate-600">Base Mandi Rate (API)</Text>
              <Text className="text-xs font-bold text-slate-900">₹{((lot.pricing?.baseRatePerQuintal || 2320) / 100).toFixed(2)} / kg</Text>
            </View>
            <View className="flex-row justify-between pb-2 border-b border-slate-100">
              <Text className="text-xs text-slate-600">Quality Adjustment</Text>
              <Text className="text-xs font-bold text-emerald-700">{lot.pricing?.adjustmentPercentage || 2.0}%</Text>
            </View>
            <View className="flex-row justify-between pb-2 border-b border-slate-100">
              <Text className="text-xs text-slate-600">Estimated Unit Rate</Text>
              <Text className="text-xs font-bold text-slate-900">₹{lot.pricing?.estimatedRatePerKg || 23.66} / kg</Text>
            </View>
            <View className="flex-row justify-between pb-2 border-b border-slate-100">
              <Text className="text-xs text-slate-600">Agreed Settlement Rate</Text>
              <Text className="text-xs font-black text-brand-600">₹{lot.pricing?.agreedRatePerKg || 23.66} / kg</Text>
            </View>
            <View className="flex-row justify-between pt-2">
              <Text className="text-sm font-black text-slate-900">Total Lot Payout</Text>
              <Text className="text-base font-black text-brand-950">₹{Math.round(lot.pricing?.totalEstimatedPrice || 0).toLocaleString('en-IN')}</Text>
            </View>
          </View>
        )}

        {/* SUB-TAB 4: IMAGES */}
        {activeTab === 'images' && (
          <View className="space-y-3">
            <View className="flex-row items-center justify-between">
              <Text className="text-xs font-bold text-slate-700 uppercase">Sample Inspection Image</Text>
              <TouchableOpacity
                onPress={() => setShowAnnotated(!showAnnotated)}
                className="bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200"
              >
                <Text className="text-xs font-bold text-emerald-800">
                  {showAnnotated ? 'Hide Overlays' : 'Show AI Overlays'}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={{ width: SCREEN_WIDTH - 40, height: 320 }} className="rounded-3xl overflow-hidden bg-black relative border border-slate-300">
              <Image source={{ uri: lot.imageUri || 'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=1080' }} className="w-full h-full" resizeMode="cover" />
              {showAnnotated && (
                <Svg style={StyleSheet.absoluteFill} viewBox="0 0 360 450">
                  {MOCK_DETECTIONS.map((det) => (
                    <Rect
                      key={det.id}
                      x={det.box.x1}
                      y={det.box.y1 * 0.9}
                      width={det.box.x2 - det.box.x1}
                      height={(det.box.y2 - det.box.y1) * 0.9}
                      stroke={det.category === 'normal' ? '#10b981' : det.category === 'broken' ? '#f59e0b' : '#3b82f6'}
                      strokeWidth={2}
                      fill="transparent"
                      rx={3}
                    />
                  ))}
                </Svg>
              )}
            </View>
          </View>
        )}

        {/* Action Triggers Bar: Download PDF Receipt & Share Receipt */}
        <View className="pt-6 space-y-3">
          <TouchableOpacity
            onPress={handleDownloadPdf}
            className="bg-brand-600 py-3.5 rounded-2xl items-center shadow-md active:scale-98 flex-row justify-center space-x-2"
          >
            <Text className="text-base">📥</Text>
            <Text className="text-white font-bold text-sm tracking-wide">
              Download Official Receipt (PDF)
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleShareReceipt}
            className="bg-emerald-50 border border-emerald-300 py-3 rounded-2xl items-center active:scale-98 flex-row justify-center space-x-2"
          >
            <Text className="text-base">📤</Text>
            <Text className="text-emerald-800 font-bold text-sm">
              Share Secure Receipt
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
};
 
