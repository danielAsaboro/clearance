import { useState, useRef, useEffect } from "react";
import { View, Pressable, Text, ActivityIndicator } from "react-native";
import { Video, ResizeMode, type AVPlaybackStatus } from "expo-av";
import { Volume2, VolumeX } from "lucide-react-native";

interface VideoPlayerProps {
  url: string;
  thumbnailUrl?: string | null;
  title?: string | null;
  autoplay?: boolean;
  muted?: boolean;
  onToggleMute?: () => void;
}

export function VideoPlayer({
  url,
  thumbnailUrl,
  title,
  autoplay = true,
  muted = true,
  onToggleMute,
}: VideoPlayerProps) {
  const videoRef = useRef<Video>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.setIsMutedAsync(muted);
    }
  }, [muted]);

  return (
    <View className="flex-1 bg-[#111] rounded-xl overflow-hidden relative">
      <Video
        ref={videoRef}
        source={{ uri: url }}
        posterSource={thumbnailUrl ? { uri: thumbnailUrl } : undefined}
        usePoster={!!thumbnailUrl}
        resizeMode={ResizeMode.CONTAIN}
        shouldPlay={autoplay}
        isLooping
        isMuted={muted}
        onLoadStart={() => setLoading(true)}
        onLoad={() => setLoading(false)}
        style={{ flex: 1 }}
      />

      {loading && (
        <View className="absolute inset-0 items-center justify-center bg-black/50">
          <ActivityIndicator size="large" color="#F5E642" />
        </View>
      )}

      {/* Mute toggle */}
      <Pressable
        onPress={onToggleMute}
        className="absolute bottom-3 right-3 w-10 h-10 rounded-full bg-black/60 items-center justify-center"
      >
        {muted ? (
          <VolumeX size={18} color="#fff" />
        ) : (
          <Volume2 size={18} color="#fff" />
        )}
      </Pressable>

      {/* Title overlay */}
      {title && (
        <View className="absolute bottom-3 left-3 bg-black/60 rounded-lg px-2 py-1">
          <Text className="text-white text-xs" numberOfLines={1}>
            {title}
          </Text>
        </View>
      )}
    </View>
  );
}
