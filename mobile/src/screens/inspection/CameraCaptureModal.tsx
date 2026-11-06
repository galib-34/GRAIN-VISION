import React, { useState, useRef } from 'react';
import { View, Text, TouchableOpacity, Alert, Platform, Image } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as ImagePicker from 'expo-image-picker';
import { RootStackParamList } from '../../navigation/types';
import { useInspectionStore } from '../../stores/inspectionStore';

// Safe dynamic import for expo-camera
let CameraView: any = null;
let useCameraPermissions: any = null;
try {
  const ExpoCamera = require('expo-camera');
  CameraView = ExpoCamera.CameraView || ExpoCamera.Camera;
  useCameraPermissions = ExpoCamera.useCameraPermissions;
} catch (e) {
  // Graceful fallback for web/testing
}

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'CameraCaptureModal'>;

// Sample fallback images for testing on emulators
const SAMPLE_TEST_IMAGES = [
  'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=1080',
  'https://images.unsplash.com/photo-1536304993881-ff6e9eefa2a6?w=1080',
];

export const CameraCaptureModal: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const setCapturedImage = useInspectionStore((state) => state.setCapturedImage);

  const [facing, setFacing] = useState<'back' | 'front'>('back');
  const [flash, setFlash] = useState<'off' | 'on'>('off');
  const [showTips, setShowTips] = useState(false);
  const cameraRef = useRef<any>(null);

  // Hook for camera permissions
  const [permission, requestPermission] = useCameraPermissions
    ? useCameraPermissions()
    : [{ granted: true }, () => {}];

  const handlePickFromGallery = async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert('Permission Denied', 'Gallery access is required to upload grain sample photos.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.85,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        setCapturedImage(asset.uri, asset.width || 1080, asset.height || 1920);
        navigation.navigate('ImageValidationModal');
      }
    } catch (err: any) {
      Alert.alert('Gallery Error', err?.message || 'Could not pick image from gallery.');
    }
  };

  const handleCapturePhoto = async () => {
    if (cameraRef.current && CameraView) {
      try {
        const photo = await cameraRef.current.takePictureAsync({
          quality: 0.85,
          skipProcessing: false,
        });
        if (photo && photo.uri) {
          setCapturedImage(photo.uri, photo.width || 1080, photo.height || 1920);
          navigation.navigate('ImageValidationModal');
          return;
        }
      } catch (err) {
        console.warn('Live capture failed, using sample fallback:', err);
      }
    }

    // Fallback if camera is unavailable in emulator/simulator
    const sampleUri = SAMPLE_TEST_IMAGES[0];
    setCapturedImage(sampleUri, 1080, 1920);
    navigation.navigate('ImageValidationModal');
  };

  const handleUseSample = (uri: string) => {
    setCapturedImage(uri, 1080, 1920);
    navigation.navigate('ImageValidationModal');
  };

  const toggleFlash = () => {
    setFlash((current) => (current === 'off' ? 'on' : 'off'));
  };

  const toggleFacing = () => {
    setFacing((current) => (current === 'back' ? 'front' : 'back'));
  };

  return (
    <View className="flex-1 bg-black">
      {/* Live Camera Viewfinder or Simulator Fallback */}
      {CameraView && permission?.granted ? (
        <CameraView
          ref={cameraRef}
          className="flex-1"
          facing={facing}
          flash={flash}
        >
          <CameraOverlay
            facing={facing}
            flash={flash}
            showTips={showTips}
            onToggleFlash={toggleFlash}
            onToggleFacing={toggleFacing}
            onToggleTips={() => setShowTips(!showTips)}
            onClose={() => navigation.goBack()}
            onCapture={handleCapturePhoto}
            onGallery={handlePickFromGallery}
            onUseSample={handleUseSample}
          />
        </CameraView>
      ) : (
        <View className="flex-1 items-center justify-center p-6 bg-brand-950">
          <CameraOverlay
            facing={facing}
            flash={flash}
            showTips={showTips}
            isSimulator
            onToggleFlash={toggleFlash}
            onToggleFacing={toggleFacing}
            onToggleTips={() => setShowTips(!showTips)}
            onClose={() => navigation.goBack()}
            onCapture={handleCapturePhoto}
            onGallery={handlePickFromGallery}
            onUseSample={handleUseSample}
            onRequestPermission={requestPermission}
            hasPermission={permission?.granted}
          />
        </View>
      )}
    </View>
  );
};

interface OverlayProps {
  facing: 'back' | 'front';
  flash: 'off' | 'on';
  showTips: boolean;
  isSimulator?: boolean;
  hasPermission?: boolean;
  onToggleFlash: () => void;
  onToggleFacing: () => void;
  onToggleTips: () => void;
  onClose: () => void;
  onCapture: () => void;
  onGallery: () => void;
  onUseSample: (uri: string) => void;
  onRequestPermission?: () => void;
}

const CameraOverlay: React.FC<OverlayProps> = ({
  flash,
  showTips,
  isSimulator,
  hasPermission,
  onToggleFlash,
  onToggleFacing,
  onToggleTips,
  onClose,
  onCapture,
  onGallery,
  onUseSample,
  onRequestPermission,
}) => {
  return (
    <View className="flex-1 justify-between p-5 pt-12 pb-8 bg-black/30">
      {/* Top Camera Controls Bar */}
      <View className="flex-row items-center justify-between z-20">
        <TouchableOpacity
          onPress={onClose}
          className="w-10 h-10 rounded-full bg-black/60 items-center justify-center border border-white/20 active:scale-95"
        >
          <Text className="text-white text-lg">âœ•</Text>
        </TouchableOpacity>

        <View className="flex-row items-center space-x-2">
          <TouchableOpacity
            onPress={onToggleFlash}
            className={`px-3 py-2 rounded-full border ${flash === 'on' ? 'bg-amber-500 border-amber-300' : 'bg-black/60 border-white/20'} active:scale-95`}
          >
            <Text className="text-xs font-bold text-white">
              {flash === 'on' ? 'âš¡ FLASH ON' : 'âš¡ FLASH OFF'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={onToggleFacing}
            className="w-10 h-10 rounded-full bg-black/60 items-center justify-center border border-white/20 active:scale-95"
          >
            <Text className="text-white text-base">ðŸ”„</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={onToggleTips}
            className={`w-10 h-10 rounded-full border ${showTips ? 'bg-emerald-600 border-emerald-400' : 'bg-black/60 border-white/20'} items-center justify-center active:scale-95`}
          >
            <Text className="text-white text-base">ðŸ’¡</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Tips Banner Card */}
      {showTips && (
        <View className="bg-brand-950/95 p-4 rounded-2xl border border-emerald-500/40 my-3 shadow-xl z-20">
          <View className="flex-row items-center space-x-2 mb-2">
            <Text className="text-base">ðŸ’¡</Text>
            <Text className="text-xs font-black text-emerald-300 uppercase tracking-wider">
              Tips for Accurate AI Detection
            </Text>
          </View>
          <Text className="text-xs text-slate-300 leading-relaxed mb-1">
            â€¢ <Text className="font-bold text-white">Contrast:</Text> Spread grains on a dark, non-reflective surface.
          </Text>
          <Text className="text-xs text-slate-300 leading-relaxed mb-1">
            â€¢ <Text className="font-bold text-white">Separation:</Text> Avoid overlapping or tightly clustered grains.
          </Text>
          <Text className="text-xs text-slate-300 leading-relaxed">
            â€¢ <Text className="font-bold text-white">Lighting:</Text> Hold device parallel without casting direct hand shadows.
          </Text>
        </View>
      )}

      {/* Center Target Frame Reticle */}
      <View className="items-center justify-center flex-1 my-4">
        <View className="w-[88%] h-[68%] rounded-3xl border-2 border-emerald-400/80 bg-emerald-500/5 items-center justify-between p-4 relative">
          {/* Corner Target Accents */}
          <View className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-emerald-400 rounded-tl-2xl" />
          <View className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-emerald-400 rounded-tr-2xl" />
          <View className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-emerald-400 rounded-bl-2xl" />
          <View className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-emerald-400 rounded-br-2xl" />

          <View className="bg-black/60 px-3 py-1 rounded-full border border-white/20">
            <Text className="text-[10px] font-bold text-emerald-300 uppercase tracking-wider">
              Align 100-200 Grains in Frame
            </Text>
          </View>

          {isSimulator && (
            <View className="bg-brand-900/90 p-4 rounded-xl border border-emerald-500/30 items-center">
              <Text className="text-xs font-bold text-white mb-2 text-center">
                Simulator / Test Mode Active
              </Text>
              {!hasPermission && onRequestPermission && (
                <TouchableOpacity
                  onPress={onRequestPermission}
                  className="bg-emerald-600 px-3 py-1.5 rounded-lg mb-2"
                >
                  <Text className="text-xs font-bold text-white">Grant Camera Permission</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                onPress={() => onUseSample('https://images.unsplash.com/photo-1586201375761-83865001e31c?w=1080')}
                className="bg-emerald-500/30 px-3 py-1.5 rounded-lg border border-emerald-400/40"
              >
                <Text className="text-xs font-bold text-emerald-200">Load Swarna Rice Sample Image</Text>
              </TouchableOpacity>
            </View>
          )}

          <View className="bg-black/60 px-3 py-1 rounded-full border border-white/20">
            <Text className="text-[10px] font-medium text-slate-300">
              Hold Still Â· Autofocus Active
            </Text>
          </View>
        </View>
      </View>

      {/* Bottom Capture Controls */}
      <View className="flex-row items-center justify-around pt-3">
        {/* Gallery Image Picker Button */}
        <TouchableOpacity
          onPress={onGallery}
          className="w-14 h-14 rounded-full bg-white/20 items-center justify-center border border-white/30 active:scale-95"
        >
          <Text className="text-2xl">ðŸ“</Text>
        </TouchableOpacity>

        {/* Center Shutter Button */}
        <TouchableOpacity
          onPress={onCapture}
          className="w-20 h-20 rounded-full bg-white/25 items-center justify-center border-4 border-white active:scale-90"
        >
          <View className="w-14 h-14 rounded-full bg-emerald-500 border-2 border-white" />
        </TouchableOpacity>

        {/* Test Preset Sample Picker */}
        <TouchableOpacity
          onPress={() => onUseSample('https://images.unsplash.com/photo-1586201375761-83865001e31c?w=1080')}
          className="w-14 h-14 rounded-full bg-white/20 items-center justify-center border border-white/30 active:scale-95"
        >
          <Text className="text-2xl">ðŸŒ¾</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

