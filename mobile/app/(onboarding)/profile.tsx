import { useState } from "react";
import { View, Text, Pressable, Image, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { ArrowLeft, Eye, Upload, X } from "lucide-react-native";
import { ProgressBar } from "@/components/ProgressBar";
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";
import { useOnboarding } from "@/lib/onboarding-context";
import { apiFetch } from "@/lib/api";

const TOTAL_STEPS = 4;

export default function ProfileStep() {
  const { data, updateData } = useOnboarding();
  const [preview, setPreview] = useState<string | null>(
    data.profilePhoto || null
  );
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const canContinue = data.displayName.trim() !== "";

  const handlePickImage = async () => {
    setUploadError(null);

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (result.canceled) return;

    const asset = result.assets[0];
    setPreview(asset.uri);
    setUploading(true);

    try {
      // Get presigned upload URL
      const { uploadUrl, publicUrl } = await apiFetch<{
        uploadUrl: string;
        publicUrl: string;
      }>("/api/upload/presign", {
        method: "POST",
        body: { contentType: asset.mimeType || "image/jpeg" },
      });

      // Upload the file
      const response = await fetch(asset.uri);
      const blob = await response.blob();

      const uploadRes = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": asset.mimeType || "image/jpeg" },
        body: blob,
      });

      if (!uploadRes.ok) throw new Error("Upload failed");

      updateData({ profilePhoto: publicUrl });
      setPreview(publicUrl);
    } catch {
      setUploadError("Upload failed. Please try again.");
      setPreview(null);
      updateData({ profilePhoto: "" });
    } finally {
      setUploading(false);
    }
  };

  const clearPhoto = () => {
    setPreview(null);
    updateData({ profilePhoto: "" });
    setUploadError(null);
  };

  return (
    <SafeAreaView className="flex-1 bg-black">
      <View className="flex-1 px-6 pt-6">
        {/* Header */}
        <View className="flex-row items-center justify-between mb-4">
          <Pressable
            onPress={() => router.back()}
            className="w-10 h-10 rounded-full border border-[#333] items-center justify-center"
          >
            <ArrowLeft size={20} color="#fff" />
          </Pressable>
          <View className="w-8 h-8 bg-[#F5E642] rounded-full items-center justify-center">
            <Eye size={16} color="#000" />
          </View>
          <Text className="text-[#888] text-xs tracking-wider">
            STEP 3 OF {TOTAL_STEPS}
          </Text>
        </View>

        <ProgressBar currentStep={3} totalSteps={TOTAL_STEPS} />

        <View className="mt-8">
          <Text className="text-2xl font-bold text-white">
            Set Up Your Profile
          </Text>
          <Text className="text-[#888] text-sm mt-1">
            Tell us about yourself to get started
          </Text>

          <View className="mt-8">
            <Input
              label="DISPLAY NAME"
              placeholder="Your display name"
              value={data.displayName}
              onChangeText={(text) => updateData({ displayName: text })}
              autoCapitalize="words"
            />
          </View>

          <View className="mt-6">
            <Text className="text-[#888] text-xs tracking-wider uppercase mb-2">
              Profile Photo (Optional)
            </Text>

            {preview ? (
              <View className="relative self-start">
                <Image
                  source={{ uri: preview }}
                  className="w-24 h-24 rounded-xl"
                  style={{ borderWidth: 1, borderColor: "#333" }}
                />
                {uploading ? (
                  <View className="absolute inset-0 bg-black/60 rounded-xl items-center justify-center">
                    <ActivityIndicator size="small" color="#F5E642" />
                  </View>
                ) : (
                  <Pressable
                    onPress={clearPhoto}
                    className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 rounded-full items-center justify-center"
                  >
                    <X size={14} color="#fff" />
                  </Pressable>
                )}
              </View>
            ) : (
              <Pressable
                onPress={handlePickImage}
                className="bg-[#1A1A1A] rounded-xl px-4 py-4 flex-row items-center gap-3 border border-transparent"
              >
                <Upload size={16} color="#555" />
                <Text className="text-[#555] text-sm">Choose an image</Text>
              </Pressable>
            )}

            {uploadError && (
              <Text className="text-red-400 text-xs mt-2">{uploadError}</Text>
            )}
          </View>
        </View>
      </View>

      <View className="px-6 pb-6">
        <Button
          title="Continue"
          size="lg"
          disabled={!canContinue || uploading}
          onPress={() => router.push("/(onboarding)/complete")}
        />
      </View>
    </SafeAreaView>
  );
}
