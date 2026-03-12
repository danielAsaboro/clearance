import { useState } from "react";
import { View, Pressable, Text } from "react-native";
import { Check, TrendingUp } from "lucide-react-native";
import { VideoPlayer } from "./VideoPlayer";

interface VideoData {
  id: string;
  url: string;
  thumbnailUrl?: string | null;
  title?: string | null;
}

interface MatchupPickerProps {
  videoA: VideoData;
  videoB: VideoData;
  onPick: (decision: "video_a" | "video_b") => void;
  voted: "video_a" | "video_b" | null;
  disabled?: boolean;
  muted?: boolean;
  onToggleMute?: () => void;
}

export function MatchupPicker({
  videoA,
  videoB,
  onPick,
  voted,
  disabled = false,
  muted: mutedProp,
  onToggleMute: onToggleMuteProp,
}: MatchupPickerProps) {
  const [activeVideo, setActiveVideo] = useState<"a" | "b">("a");
  const [localMuted, setLocalMuted] = useState(true);

  const muted = mutedProp !== undefined ? mutedProp : localMuted;
  const handleToggleMute =
    onToggleMuteProp ?? (() => setLocalMuted((m) => !m));

  const currentVideo = activeVideo === "a" ? videoA : videoB;

  return (
    <View className="flex-1">
      {/* Toggle Bar */}
      <View className="flex-row gap-2 mb-3">
        <Pressable
          onPress={() => setActiveVideo("a")}
          className={`flex-1 py-2.5 rounded-xl items-center ${
            activeVideo === "a"
              ? "bg-[#F5E642]"
              : "bg-[#1A1A1A] border border-[#2A2A2A]"
          }`}
        >
          <Text
            className={`text-sm font-bold ${
              activeVideo === "a" ? "text-black" : "text-[#888]"
            }`}
          >
            Video A
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setActiveVideo("b")}
          className={`flex-1 py-2.5 rounded-xl items-center ${
            activeVideo === "b"
              ? "bg-[#F5E642]"
              : "bg-[#1A1A1A] border border-[#2A2A2A]"
          }`}
        >
          <Text
            className={`text-sm font-bold ${
              activeVideo === "b" ? "text-black" : "text-[#888]"
            }`}
          >
            Video B
          </Text>
        </Pressable>
      </View>

      {/* Video Player */}
      <View className="flex-1">
        <VideoPlayer
          key={currentVideo.id}
          url={currentVideo.url}
          thumbnailUrl={currentVideo.thumbnailUrl}
          title={currentVideo.title}
          autoplay
          muted={muted}
          onToggleMute={handleToggleMute}
        />
      </View>

      {/* Pick Buttons */}
      <View className="flex-row gap-2 mt-3">
        <Pressable
          onPress={() => onPick("video_a")}
          disabled={disabled}
          className={`flex-1 py-3.5 rounded-xl flex-row items-center justify-center gap-2 ${
            voted === "video_a"
              ? "bg-[#F5E642]"
              : "bg-[#1A1A1A] border border-[#2A2A2A]"
          }`}
        >
          {voted === "video_a" ? (
            <>
              <Check size={16} color="#000" />
              <Text className="text-sm font-bold text-black">Picked A</Text>
            </>
          ) : (
            <>
              <TrendingUp size={16} color="#fff" />
              <Text className="text-sm font-bold text-white">A will trend</Text>
            </>
          )}
        </Pressable>
        <Pressable
          onPress={() => onPick("video_b")}
          disabled={disabled}
          className={`flex-1 py-3.5 rounded-xl flex-row items-center justify-center gap-2 ${
            voted === "video_b"
              ? "bg-[#F5E642]"
              : "bg-[#1A1A1A] border border-[#2A2A2A]"
          }`}
        >
          {voted === "video_b" ? (
            <>
              <Check size={16} color="#000" />
              <Text className="text-sm font-bold text-black">Picked B</Text>
            </>
          ) : (
            <>
              <TrendingUp size={16} color="#fff" />
              <Text className="text-sm font-bold text-white">B will trend</Text>
            </>
          )}
        </Pressable>
      </View>
    </View>
  );
}
