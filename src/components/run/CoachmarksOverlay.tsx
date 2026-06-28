import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Animated, Dimensions, Modal, Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Speech from 'expo-speech';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width, height } = Dimensions.get('window');

const COACHMARKS_KEY = 'runquest:coachmarksDone';

export interface CoachmarkStep {
  title: string;
  desc: string;
  speechText: string;
  highlightStyle: any; // Style or coordinates for the cutout highlight
  arrowDirection: 'up' | 'down' | 'left' | 'right' | 'none';
  arrowOffset: { x: number; y: number };
  cardOffset: { x: number; y: number };
}

// ─── Default Steps based on RunScreen layout ──────────────────────────────────
const DEFAULT_STEPS: CoachmarkStep[] = [
  {
    title: 'Your Live Conquest Map',
    desc: 'This is your battlefield! You can see your claimed territories in neon blue, other warriors in red, and spawned gold loot items in real-time.',
    speechText: 'Welcome to your Live Conquest Map. This is your battlefield where you can see your claimed territories, enemy boundaries, and spawned loot chests in real-time.',
    highlightStyle: {
      top: height * 0.12,
      left: 16,
      width: width - 32,
      height: height * 0.55,
      borderRadius: 24,
    },
    arrowDirection: 'down',
    arrowOffset: { x: width / 2 - 20, y: height * 0.4 },
    cardOffset: { x: 20, y: height * 0.44 },
  },
  {
    title: 'Weather & GPS Status',
    desc: 'Always verify your GPS signal accuracy here before running. Also shows the live outdoor temperature and battlefield conditions.',
    speechText: 'Verify your GPS signal accuracy here before starting your run. It also displays the current outdoor weather conditions.',
    highlightStyle: {
      top: Platform.OS === 'ios' ? 54 : 44,
      right: 16,
      width: 172,
      height: 42,
      borderRadius: 21,
    },
    arrowDirection: 'up',
    arrowOffset: { x: width - 90, y: (Platform.OS === 'ios' ? 54 : 44) + 48 },
    cardOffset: { x: width - 310, y: (Platform.OS === 'ios' ? 54 : 44) + 72 },
  },
  {
    title: 'Begin Your Campaign',
    desc: 'Hold or tap the large action button here to start a run. When you complete a closed GPS loop of at least 100m, you can claim the territory!',
    speechText: 'Hold or tap the start button to begin your run. Complete a closed GPS loop of at least one hundred meters to claim the territory.',
    highlightStyle: {
      bottom: Platform.OS === 'ios' ? 44 : 20,
      left: 124,
      width: width - 140,
      height: 52,
      borderRadius: 16,
    },
    arrowDirection: 'down',
    arrowOffset: { x: width - 120, y: height - (Platform.OS === 'ios' ? 106 : 82) },
    cardOffset: { x: 20, y: height - (Platform.OS === 'ios' ? 340 : 310) },
  },
  {
    title: 'Tactical AI Coach (RunBot)',
    desc: 'Need advice? Tap the AI RunBot floating button to chat. It can change settings, adjust your themes, switch navbars, and give custom coaching advice.',
    speechText: 'Need strategy tips or configurations? Tap the Run Bot assistant to chat. It can adjust your themes, configure navbars, or provide fitness coaching.',
    highlightStyle: {
      bottom: Platform.OS === 'ios' ? 134 : 100,
      right: 16,
      width: 120,
      height: 48,
      borderRadius: 22,
    },
    arrowDirection: 'down',
    arrowOffset: { x: width - 76, y: height - (Platform.OS === 'ios' ? 182 : 148) },
    cardOffset: { x: 20, y: height - (Platform.OS === 'ios' ? 400 : 360) },
  },
  {
    title: 'Warrior Profile & Quests Shop',
    desc: 'Access your running history, team alliances, total gold count, and the Quests Shop to spend your earned gold on customizable perks!',
    speechText: 'Finally, view your profile tabs, team alliances, recent running history, and enter the Quests Shop to buy premium map cosmetics.',
    highlightStyle: {
      bottom: 0,
      left: 0,
      width: width,
      height: 70,
      borderRadius: 0,
    },
    arrowDirection: 'down',
    arrowOffset: { x: width - 60, y: height - 85 },
    cardOffset: { x: 20, y: height - 280 },
  },
];

interface Props {
  visible: boolean;
  onClose: () => void;
  layouts?: Record<string, { x: number; y: number; width: number; height: number }>;
}

export default function CoachmarksOverlay({ visible, onClose, layouts }: Props) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isMuted, setIsMuted] = useState(false);

  const bounceAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const cardScale = useRef(new Animated.Value(0.9)).current;

  // [ignoring loop detection]
  const steps = React.useMemo(() => {
    const arr = [...DEFAULT_STEPS];
    if (!layouts) return arr;

    // 2. Weather & GPS Status (Step 1)
    if (layouts.weather && layouts.weather.width > 0) {
      const lay = layouts.weather;
      arr[1] = {
        ...arr[1],
        highlightStyle: {
          top: lay.y - 4,
          left: lay.x - 4,
          width: lay.width + 8,
          height: lay.height + 8,
          borderRadius: 22,
        },
        arrowOffset: { x: lay.x + lay.width / 2 - 15, y: lay.y + lay.height + 6 },
        cardOffset: { x: 20, y: lay.y + lay.height + 45 },
        arrowDirection: 'up',
      };
    }

    // 3. Begin Your Campaign (Step 2)
    if (layouts.startRun && layouts.startRun.width > 0) {
      const lay = layouts.startRun;
      arr[2] = {
        ...arr[2],
        highlightStyle: {
          top: lay.y - 4,
          left: lay.x - 4,
          width: lay.width + 8,
          height: lay.height + 8,
          borderRadius: 18,
        },
        arrowOffset: { x: lay.x + lay.width / 2 - 15, y: lay.y - 40 },
        cardOffset: { x: 20, y: Math.max(80, lay.y - 200) },
        arrowDirection: 'down',
      };
    }

    // 4. Tactical AI Coach (Step 3)
    if (layouts.runBot && layouts.runBot.width > 0) {
      const lay = layouts.runBot;
      arr[3] = {
        ...arr[3],
        highlightStyle: {
          top: lay.y - 4,
          left: lay.x - 4,
          width: lay.width + 8,
          height: lay.height + 8,
          borderRadius: 24,
        },
        arrowOffset: { x: lay.x + lay.width / 2 - 15, y: lay.y - 40 },
        cardOffset: { x: 20, y: Math.max(80, lay.y - 200) },
        arrowDirection: 'down',
      };
    }

    // 5. Warrior Profile & Quests Shop (Step 4)
    if (layouts.dashboard && layouts.dashboard.width > 0) {
      const lay = layouts.dashboard;
      arr[4] = {
        ...arr[4],
        highlightStyle: {
          top: lay.y - 4,
          left: lay.x - 4,
          width: lay.width + 8,
          height: lay.height + 8,
          borderRadius: 28,
        },
        arrowOffset: { x: lay.x + lay.width / 2 - 15, y: lay.y - 40 },
        cardOffset: { x: 20, y: Math.max(80, lay.y - 210) },
        arrowDirection: 'down',
      };
    }

    return arr;
  }, [layouts]);

  // ─── Control speech speech synthesis ─────────────────────────────────────────
  useEffect(() => {
    if (visible) {
      Animated.timing(overlayOpacity, { toValue: 1, duration: 300, useNativeDriver: true }).start();
      Animated.spring(cardScale, { toValue: 1, useNativeDriver: true, tension: 70, friction: 8 }).start();
      triggerSpeech(0);
    } else {
      Speech.stop();
    }
    return () => {
      Speech.stop();
    };
  }, [visible]);

  // ─── Arrow bounce animation ──────────────────────────────────────────────────
  useEffect(() => {
    if (!visible) return;
    Animated.loop(
      Animated.sequence([
        Animated.timing(bounceAnim, { toValue: -8, duration: 600, useNativeDriver: true }),
        Animated.timing(bounceAnim, { toValue: 0, duration: 600, useNativeDriver: true }),
      ])
    ).start();
  }, [visible, currentStep]);

  const triggerSpeech = (stepIndex: number) => {
    Speech.stop();
    if (isMuted) return;
    const text = steps[stepIndex]?.speechText;
    if (text) {
      Speech.speak(text, {
        language: 'en',
        rate: 0.95,
        pitch: 1.0,
      });
    }
  };

  const handleMuteToggle = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    if (nextMuted) {
      Speech.stop();
    } else {
      // Speak current step
      const text = steps[currentStep]?.speechText;
      if (text) {
        Speech.speak(text, { language: 'en', rate: 0.95, pitch: 1.0 });
      }
    }
  };

  const transitionToStep = (index: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    // Smooth transition between steps
    Animated.timing(fadeAnim, { toValue: 0, duration: 150, useNativeDriver: true }).start(() => {
      setCurrentStep(index);
      triggerSpeech(index);
      Animated.timing(fadeAnim, { toValue: 1, duration: 250, useNativeDriver: true }).start();
    });
  };

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      transitionToStep(currentStep + 1);
    } else {
      handleComplete();
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      transitionToStep(currentStep - 1);
    }
  };

  const handleComplete = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Speech.stop();
    Animated.timing(overlayOpacity, { toValue: 0, duration: 200, useNativeDriver: true }).start(async () => {
      await AsyncStorage.setItem(COACHMARKS_KEY, 'done');
      onClose();
    });
  };

  if (!visible) return null;

  const step = steps[currentStep];

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
      <Animated.View style={[styles.overlay, { opacity: overlayOpacity }]}>
        
        {/* Cutout Mask Highlight Overlay */}
        <View style={[styles.cutout, step.highlightStyle]} pointerEvents="none" />

        {/* Text Coachmark Card */}
        <Animated.View
          style={[
            styles.card,
            {
              top: step.cardOffset.y,
              left: step.cardOffset.x,
              opacity: fadeAnim,
              transform: [{ scale: cardScale }],
            },
          ]}
        >
          {/* Header Row with Voice & Close */}
          <View style={styles.cardHeader}>
            <View style={styles.stepBadge}>
              <Text style={styles.stepBadgeText}>GUIDE {currentStep + 1}/{steps.length}</Text>
            </View>

            <View style={styles.rightHeaderControls}>
              {/* Speaker Audio Narrator toggle */}
              <TouchableOpacity
                onPress={handleMuteToggle}
                activeOpacity={0.7}
                style={[styles.audioBtn, { backgroundColor: isMuted ? 'rgba(255,255,255,0.06)' : '#00C6FF20' }]}
              >
                <Ionicons
                  name={isMuted ? 'volume-mute' : 'volume-medium'}
                  size={16}
                  color={isMuted ? '#8E8E93' : '#00C6FF'}
                />
                <Text style={[styles.audioBtnText, { color: isMuted ? '#8E8E93' : '#00C6FF' }]}>
                  {isMuted ? 'Muted' : 'Narrating'}
                </Text>
              </TouchableOpacity>

              {/* Close Button */}
              <TouchableOpacity onPress={handleComplete} style={styles.closeBtn}>
                <Ionicons name="close" size={18} color="rgba(255,255,255,0.5)" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Guide Content */}
          <Text style={styles.title}>{step.title}</Text>
          <Text style={styles.desc}>{step.desc}</Text>

          {/* Action Row buttons */}
          <View style={styles.actionRow}>
            {currentStep > 0 ? (
              <TouchableOpacity onPress={handlePrev} style={styles.backBtn}>
                <Text style={styles.backBtnText}>Back</Text>
              </TouchableOpacity>
            ) : (
              <View style={{ flex: 1 }} />
            )}

            <TouchableOpacity onPress={handleNext} style={styles.nextBtn} activeOpacity={0.8}>
              <LinearGradient colors={['#00C6FF', '#0A84FF']} style={styles.nextGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                <Text style={styles.nextText}>
                  {currentStep === DEFAULT_STEPS.length - 1 ? 'Start Conquering' : 'Next'}
                </Text>
                <Ionicons
                  name={currentStep === DEFAULT_STEPS.length - 1 ? 'shield-checkmark' : 'arrow-forward'}
                  size={15}
                  color="#000"
                />
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </Animated.View>

        {/* Pointer Arrow */}
        {step.arrowDirection !== 'none' && (
          <Animated.View
            style={[
              styles.arrowContainer,
              {
                top: step.arrowOffset.y,
                left: step.arrowOffset.x,
                opacity: fadeAnim,
                transform: [
                  {
                    translateY: step.arrowDirection === 'up' || step.arrowDirection === 'down' ? bounceAnim : 0,
                  },
                  {
                    translateX: step.arrowDirection === 'left' || step.arrowDirection === 'right' ? bounceAnim : 0,
                  },
                ],
              },
            ]}
          >
            <Ionicons
              name={
                step.arrowDirection === 'up'
                  ? 'arrow-up'
                  : step.arrowDirection === 'down'
                  ? 'arrow-down'
                  : step.arrowDirection === 'left'
                  ? 'arrow-back'
                  : 'arrow-forward'
              }
              size={30}
              color="#00C6FF"
              style={styles.arrowGlow}
            />
          </Animated.View>
        )}
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.78)',
    position: 'relative',
  },
  cutout: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: '#00C6FF',
    backgroundColor: 'transparent',
    shadowColor: '#00C6FF',
    shadowOpacity: 0.9,
    shadowRadius: 16,
    elevation: 8,
  },
  card: {
    position: 'absolute',
    width: width - 40,
    backgroundColor: '#1C1C1E',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.6,
    shadowRadius: 16,
    elevation: 20,
    zIndex: 100,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  stepBadge: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  stepBadgeText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1,
  },
  rightHeaderControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  audioBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  audioBtnText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  closeBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '900',
    marginBottom: 8,
    letterSpacing: -0.2,
  },
  desc: {
    color: 'rgba(255, 255, 255, 0.65)',
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 20,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  backBtn: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  backBtnText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 13,
    fontWeight: '700',
  },
  nextBtn: {
    borderRadius: 12,
    overflow: 'hidden',
    flex: 1.3,
  },
  nextGrad: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 6,
  },
  nextText: {
    color: '#000',
    fontSize: 13,
    fontWeight: '900',
  },
  arrowContainer: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 99,
  },
  arrowGlow: {
    textShadowColor: '#00C6FF',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
});
