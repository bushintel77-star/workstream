import { useEffect } from "react";
import { AccessibilityInfo, StyleSheet, View } from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import Svg, { Circle, Ellipse, Line, Path } from "react-native-svg";
import { tokens } from "@workstream/ui";
import {
  weatherConditionFromDay,
  type WeatherCondition,
} from "@workstream/domain";

export { weatherConditionFromDay, type WeatherCondition };

const CLOUD_LOBE = tokens.color.line.strong;
const CLOUD_LOBE_LIGHT = tokens.color.line.hairline;

type Props = {
  condition: WeatherCondition;
  size?: number;
  animated?: boolean;
  /** Pause motion when the project screen is not focused. */
  motionEnabled?: boolean;
};

export function WeatherGlyph({
  condition,
  size = 28,
  animated = true,
  motionEnabled = true,
}: Props) {
  const focused = motionEnabled;
  const bob = useSharedValue(0);
  const spin = useSharedValue(0);
  const drip = useSharedValue(0);
  const reduceMotion = useSharedValue(false);

  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((v) => {
      if (mounted) reduceMotion.value = v;
    });
    return () => {
      mounted = false;
    };
  }, [reduceMotion]);

  useEffect(() => {
    cancelAnimation(bob);
    cancelAnimation(spin);
    cancelAnimation(drip);
    bob.value = 0;
    spin.value = 0;
    drip.value = 0;

    if (!animated || !focused || reduceMotion.value) return;

    if (condition === "cloud" || condition === "wind") {
      bob.value = withRepeat(
        withSequence(
          withTiming(-2, { duration: 1400, easing: Easing.inOut(Easing.sin) }),
          withTiming(2, { duration: 1400, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
        true,
      );
    }
    if (condition === "sun") {
      spin.value = withRepeat(
        withTiming(360, { duration: 12000, easing: Easing.linear }),
        -1,
        false,
      );
    }
    if (condition === "rain") {
      drip.value = withRepeat(
        withSequence(
          withTiming(4, { duration: 500, easing: Easing.out(Easing.quad) }),
          withTiming(0, { duration: 200, easing: Easing.in(Easing.quad) }),
        ),
        -1,
        false,
      );
    }
  }, [animated, focused, condition, bob, spin, drip, reduceMotion]);

  const floatStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: bob.value }],
  }));

  const sunStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${spin.value}deg` }],
  }));

  const rainStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: drip.value }],
    opacity: 1 - drip.value / 6,
  }));

  const s = size;
  const sunFill = "#FBBF24";
  const sunStroke = "#F59E0B";

  return (
    <View style={[styles.box, { width: s, height: s }]}>
      {condition === "sun" && (
        <Animated.View style={[styles.center, sunStyle]}>
          <Svg width={s} height={s} viewBox="0 0 32 32">
            <Circle cx={16} cy={16} r={6} fill={sunFill} />
            {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => {
              const rad = (deg * Math.PI) / 180;
              const x1 = 16 + Math.cos(rad) * 9;
              const y1 = 16 + Math.sin(rad) * 9;
              const x2 = 16 + Math.cos(rad) * 12;
              const y2 = 16 + Math.sin(rad) * 12;
              return (
                <Line
                  key={deg}
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  stroke={sunStroke}
                  strokeWidth={1.8}
                  strokeLinecap="round"
                />
              );
            })}
          </Svg>
        </Animated.View>
      )}
      {condition === "cloud" && (
        <Animated.View style={[styles.center, floatStyle]}>
          <Svg width={s} height={s} viewBox="0 0 32 32">
            <Ellipse cx={14} cy={18} rx={9} ry={6} fill={CLOUD_LOBE} />
            <Ellipse cx={20} cy={16} rx={7} ry={5} fill={CLOUD_LOBE_LIGHT} />
            <Ellipse cx={11} cy={15} rx={5} ry={4} fill={tokens.color.surface.sunken} />
          </Svg>
        </Animated.View>
      )}
      {condition === "rain" && (
        <View style={styles.center}>
          <Svg width={s} height={s} viewBox="0 0 32 32">
            <Ellipse cx={16} cy={14} rx={10} ry={6} fill={CLOUD_LOBE} />
            <Ellipse cx={21} cy={12} rx={6} ry={4} fill={CLOUD_LOBE_LIGHT} />
          </Svg>
          <Animated.View style={[styles.rainDrops, rainStyle]}>
            <Svg width={s} height={s} viewBox="0 0 32 32">
              <Path
                d="M10 22 L10 26 M16 20 L16 25 M22 22 L22 27"
                stroke={tokens.color.semantic.info}
                strokeWidth={2}
                strokeLinecap="round"
              />
            </Svg>
          </Animated.View>
        </View>
      )}
      {condition === "wind" && (
        <Animated.View style={[styles.center, floatStyle]}>
          <Svg width={s} height={s} viewBox="0 0 32 32">
            <Path
              d="M8 12 Q18 8 24 12 M6 18 Q16 14 26 18 M10 24 Q20 20 28 24"
              fill="none"
              stroke={tokens.color.accent.default}
              strokeWidth={2}
              strokeLinecap="round"
            />
          </Svg>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    alignItems: "center",
    justifyContent: "center",
  },
  center: {
    position: "absolute",
    left: 0,
    top: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  rainDrops: {
    position: "absolute",
    left: 0,
    top: 0,
    width: "100%",
    height: "100%",
  },
});
