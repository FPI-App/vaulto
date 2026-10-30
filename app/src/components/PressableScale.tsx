import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native'
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withTiming, Easing } from 'react-native-reanimated'

const AnimatedPressable = Animated.createAnimatedComponent(Pressable)

// Curva de marca (§7): ease-out rápido, sin rebote.
const EASE = Easing.bezier(0.22, 1, 0.36, 1)

/**
 * Pressable que se hunde levemente al presionar (0.97). Da respuesta táctil
 * inmediata sin animar layout; con reduce-motion queda estático.
 */
export function PressableScale({
  style,
  scaleTo = 0.97,
  onPressIn,
  onPressOut,
  ...props
}: Omit<PressableProps, 'style'> & { style?: StyleProp<ViewStyle>; scaleTo?: number }) {
  const reduced = useReducedMotion()
  const scale = useSharedValue(1)
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }))

  return (
    <AnimatedPressable
      {...props}
      onPressIn={(e) => {
        if (!reduced) scale.set(withTiming(scaleTo, { duration: 120, easing: EASE }))
        onPressIn?.(e)
      }}
      onPressOut={(e) => {
        if (!reduced) scale.set(withTiming(1, { duration: 200, easing: EASE }))
        onPressOut?.(e)
      }}
      style={[style, animated]}
    />
  )
}
