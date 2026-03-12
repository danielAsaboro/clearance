import { View, Text } from "react-native";
import Svg, { Circle } from "react-native-svg";

interface RoundTimerProps {
  secondsRemaining: number;
  roundDuration: number;
  active: boolean;
}

export function RoundTimer({
  secondsRemaining,
  roundDuration,
  active,
}: RoundTimerProps) {
  const size = 40;
  const strokeWidth = 3;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = Math.min(1, secondsRemaining / roundDuration);
  const strokeDashoffset = circumference * (1 - pct);
  const color = secondsRemaining <= 5 ? "#EF4444" : "#F5E642";

  return (
    <View className="flex-row items-center gap-3">
      <View style={{ width: size, height: size }}>
        <Svg
          width={size}
          height={size}
          style={{ transform: [{ rotate: "-90deg" }] }}
        >
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="#222"
            strokeWidth={strokeWidth}
          />
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={active ? color : "#555"}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
          />
        </Svg>
        <View
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <Text
            style={{ color: active ? color : "#555", fontSize: 12 }}
            className="font-bold"
          >
            {secondsRemaining}
          </Text>
        </View>
      </View>
    </View>
  );
}
