import { WithSpringConfig } from 'react-native-reanimated';

export const SPRING_CONFIGS = {
  entrance: { damping: 18, stiffness: 120, mass: 1 } satisfies WithSpringConfig,
  bounce:   { damping: 10, stiffness: 180, mass: 0.8 } satisfies WithSpringConfig,
  snappy:   { damping: 22, stiffness: 200, mass: 1 } satisfies WithSpringConfig,
  press:    { damping: 20, stiffness: 300, mass: 0.6 } satisfies WithSpringConfig,
} as const;
