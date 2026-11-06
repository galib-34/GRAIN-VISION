import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { useInspectionStore } from '../../stores/inspectionStore';
import { useAuthStore } from '../../stores/authStore';

export const QualityReportPDFModal: React.FC = () => {
  const navigation = useNavigation();
  const { metrics, detections } = useInspectionStore();
  const user = useAuthStore((state) => state.user);

  const [generating, setGenerating] = useState(false);

  const reportId = `REP-${Date.now().toString().slice(-6)}`;
  const inspectionDate = new Date().toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  const score = metrics?.qualityScore ?? 84.5;
  const grade = score >= 80 ? 'Grade A (Premium Swarna)' : score >= 60 ? 'Grade B (Standard)' : 'Grade C (High Defect)';

  const generateReportHtml = () => {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0, user-scalable=no" />
          <style>
            body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 28px; color: #172018; margin: 0; }
            .header { border-bottom: 3px solid #059669; padding-bottom: 16px; margin-bottom: 24px; }
            .logo { font-size: 28px; font-weight: 900; color: #064e3b; margin: 0; }
            .sublogo { font-size: 13px; color: #059669; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; margin-top: 4px; }
            .meta-grid { display: flex; justify-content: space-between; margin-bottom: 24px; background: #f8faf8; padding: 14px; border-radius: 8px; border: 1px solid #e2e8f0; }
            .meta-item { font-size: 12px; }
            .meta-item strong { display: block; font-size: 14px; color: #0f172a; margin-top: 2px; }
            .score-card { background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 12px; padding: 20px; text-align: center; margin-bottom: 24px; }
            .score-val { font-size: 48px; font-weight: 900; color: #064e3b; margin: 0; }
            .grade-tag { display: inline-block; background: #059669; color: white; padding: 6px 14px; border-radius: 20px; font-weight: 800; font-size: 14px; margin-top: 6px; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
            th { background: #f1f5f9; text-align: left; padding: 10px 12px; font-size: 12px; font-weight: 800; color: #334155; border-bottom: 2px solid #cbd5e1; }
            td { padding: 10px 12px; font-size: 12px; border-bottom: 1px solid #e2e8f0; }
            .disclaimer { font-size: 10px; color: #64748b; background: #fffbeb; border: 1px solid #fde68a; padding: 12px; border-radius: 8px; line-height: 1.5; margin-top: 20px; }
            .footer { margin-top: 32px; padding-top: 16px; border-top: 1px solid #e2e8f0; font-size: 11px; color: #94a3b8; display: flex; justify-content: space-between; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1 class="logo">🌾 GRAIN-VISION</h1>
            <div class="sublogo">Rice Quality Assessment & Intake Certificate</div>
          </div>

          <div class="meta-grid">
            <div class="meta-item">Certificate ID:<strong>${reportId}</strong></div>
            <div class="meta-item">Inspection Date:<strong>${inspectionDate}</strong></div>
            <div class="meta-item">Inspector:<strong>${user?.fullName || 'Procurement Officer'}</strong></div>
            <div class="meta-item">Yard:<strong>${user?.orgName || 'Mandi Intake'}</strong></div>
          </div>

          <div class="score-card">
            <div style="font-size: 11px; font-weight: 800; color: #047857; text-transform: uppercase;">Composite Sample Quality Score</div>
            <div class="score-val">${score.toFixed(1)} <span style="font-size: 18px; color: #6b7280;">/ 100</span></div>
            <div class="grade-tag">${grade}</div>
          </div>

          <h3 style="font-size: 14px; margin-bottom: 10px;">Grain Defect Distribution Matrix</h3>
          <table>
            <thead>
              <tr>
                <th>Category</th>
                <th>Defect Class</th>
                <th>Count</th>
                <th>Share %</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>🟢 Normal</td>
                <td>Sound Intact Grain</td>
                <td>${metrics?.soundCount ?? 111}</td>
                <td>${metrics?.soundPct ?? 78.2}%</td>
              </tr>
              <tr>
                <td>🟡 Broken</td>
                <td>Broken Clear / Chalky</td>
                <td>${metrics?.brokenCount ?? 18}</td>
                <td>${metrics?.brokenPct ?? 12.7}%</td>
              </tr>
              <tr>
                <td>🔵 Chalky</td>
                <td>Whole Chalky Grain</td>
                <td>${metrics?.chalkyCount ?? 9}</td>
                <td>${metrics?.chalkyPct ?? 6.3}%</td>
              </tr>
              <tr>
                <td>🔴 Discolored</td>
                <td>Unsound / Foreign Matter</td>
                <td>${metrics?.discoloredCount ?? 4}</td>
                <td>${metrics?.discoloredPct ?? 2.8}%</td>
              </tr>
            </tbody>
          </table>

          <div class="disclaimer">
            <strong>⚠️ Decision Support Notice:</strong> All scores and defect ratios are generated strictly through automated computer vision detection (YOLOv8n). This certificate is issued as an advisory decision-support instrument for commercial intake and does NOT constitute an officially accredited statutory grade or legal guarantee.
          </div>

          <div class="footer">
            <span>Verified by: ${user?.fullName || 'Authorized Inspector'}</span>
            <span>Generated via GRAIN-VISION Mobile Edge</span>
          </div>
        </body>
      </html>
    `;
  };

  const handleSharePDF = async () => {
    try {
      setGenerating(true);
      const html = generateReportHtml();
      const { uri } = await Print.printToFileAsync({ html });

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          UTI: '.pdf',
          mimeType: 'application/pdf',
          dialogTitle: 'Share GRAIN-VISION Quality Certificate',
        });
      } else {
        Alert.alert('PDF Created', `Report saved to: ${uri}`);
      }
    } catch (err: any) {
      Alert.alert('Export Error', err?.message || 'Could not generate PDF report.');
    } finally {
      setGenerating(false);
    }
  };

  const handlePrintPDF = async () => {
    try {
      setGenerating(true);
      const html = generateReportHtml();
      await Print.printAsync({ html });
    } catch (err: any) {
      Alert.alert('Print Error', err?.message || 'Print job canceled.');
    } finally {
      setGenerating(false);
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
        <Text className="text-sm font-black text-slate-800 uppercase tracking-widest">
          Quality PDF Certificate
        </Text>
        <View className="w-10" />
      </View>

      <ScrollView className="flex-1 p-5" contentContainerStyle={{ paddingBottom: 50 }}>
        {/* Document In-App Preview Container */}
        <View className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm mb-5">
          <View className="border-b border-emerald-500 pb-3 mb-4 flex-row items-center justify-between">
            <View>
              <Text className="text-base font-black text-brand-950">🌾 GRAIN-VISION</Text>
              <Text className="text-[10px] font-bold text-emerald-700 uppercase">Quality Assessment Certificate</Text>
            </View>
            <View className="items-end">
              <Text className="text-[10px] font-bold text-slate-400">ID: {reportId}</Text>
              <Text className="text-[10px] text-slate-500">{inspectionDate}</Text>
            </View>
          </View>

          {/* Assessment Score Hero */}
          <View className="bg-emerald-50/70 p-4 rounded-2xl border border-emerald-200 mb-4 items-center">
            <Text className="text-[10px] font-bold text-emerald-800 uppercase">Assessed Sample Score</Text>
            <Text className="text-4xl font-black text-brand-950 my-1">{score.toFixed(1)} / 100</Text>
            <View className="bg-emerald-600 px-3 py-0.5 rounded-full">
              <Text className="text-[10px] font-black text-white uppercase">{grade}</Text>
            </View>
          </View>

          {/* Breakdown Preview Rows */}
          <View className="space-y-2 mb-4">
            <View className="flex-row justify-between py-1 border-b border-slate-100">
              <Text className="text-xs text-slate-600">🟢 Sound Grains</Text>
              <Text className="text-xs font-bold text-slate-900">{metrics?.soundPct ?? 78.2}%</Text>
            </View>
            <View className="flex-row justify-between py-1 border-b border-slate-100">
              <Text className="text-xs text-slate-600">🟡 Broken Grains</Text>
              <Text className="text-xs font-bold text-slate-900">{metrics?.brokenPct ?? 12.7}%</Text>
            </View>
            <View className="flex-row justify-between py-1 border-b border-slate-100">
              <Text className="text-xs text-slate-600">🔵 Chalky Grains</Text>
              <Text className="text-xs font-bold text-slate-900">{metrics?.chalkyPct ?? 6.3}%</Text>
            </View>
            <View className="flex-row justify-between py-1">
              <Text className="text-xs text-slate-600">🔴 Discolored / Foreign</Text>
              <Text className="text-xs font-bold text-slate-900">{metrics?.discoloredPct ?? 2.8}%</Text>
            </View>
          </View>

          <Text className="text-[9px] text-slate-400 text-center leading-3">
            Advisory decision-support certificate · Generated on-device with YOLOv8n
          </Text>
        </View>

        {/* Action Triggers */}
        <View className="space-y-3">
          <TouchableOpacity
            onPress={handleSharePDF}
            disabled={generating}
            className="bg-brand-600 py-4 px-6 rounded-2xl items-center shadow-lg shadow-emerald-700/30 active:scale-98"
          >
            {generating ? (
              <ActivityIndicator color="#ffffff" size="small" />
            ) : (
              <Text className="text-white font-black text-base tracking-wide">
                📤 Share Certificate (WhatsApp / Email)
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handlePrintPDF}
            disabled={generating}
            className="bg-white py-3.5 px-6 rounded-2xl items-center border border-slate-300 shadow-sm active:scale-98"
          >
            <Text className="text-slate-700 font-bold text-sm">
              🖨️ Print Certificate
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
};
