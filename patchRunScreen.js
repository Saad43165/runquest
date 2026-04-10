const fs = require('fs');

const code = fs.readFileSync('c:/Users/PC/Documents/trae_projects/world_map/src/screens/RunScreen.tsx', 'utf8');
const lines = code.split('\n');

const newBlock = `        {/* Top Glass Header */}
        <AnimatedBlurView
          tint={themeName === 'light' ? 'light' : 'dark'}
          intensity={80}
          style={{
            position: 'absolute',
            top: 50,
            left: 20,
            right: 20,
            borderRadius: 20,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: 12,
            borderWidth: 1,
            borderColor: T.border,
            overflow: 'hidden',
            backgroundColor: T.surface + '80',
          }}
        >
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 2 }}>
              <Ionicons name={closedLoop ? 'checkmark-circle' : 'radio-button-off'} size={12} color={closedLoop ? T.green : T.text} />
              <Text style={{ color: T.text, fontSize: 10, fontWeight: '800' }}>{closedLoop ? 'LOOP CLOSED' : 'LOOP OPEN'}</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Ionicons name="location" size={14} color={T.green} />
              <Text style={{ color: T.white, fontSize: 14, fontWeight: '700' }} numberOfLines={1}>{place || 'Locating…'}</Text>
            </View>
          </View>
          <Text style={{ color: T.white, fontSize: 28, fontWeight: '900', fontVariant: ['tabular-nums'] }}>
            {formatTime(elapsed)}
          </Text>
        </AnimatedBlurView>

        {/* Floating Side Tools */}
        <View style={{ position: 'absolute', right: 16, top: 140, gap: 10 }}>
          <TouchableOpacity style={[{ backgroundColor: T.card, padding: 12, borderRadius: 24, borderWidth: 1, borderColor: T.border, alignItems: 'center', justifyContent: 'center' }, showPolygons && { borderColor: T.green }]} onPress={() => setShowPolygons(v => !v)}>
            <Ionicons name="map" size={18} color={showPolygons ? T.green : T.white} />
          </TouchableOpacity>
          <TouchableOpacity style={[{ backgroundColor: T.card, padding: 12, borderRadius: 24, borderWidth: 1, borderColor: T.border, alignItems: 'center', justifyContent: 'center' }, showPath && { borderColor: T.green }]} onPress={() => setShowPath(v => !v)}>
            <Ionicons name="git-commit" size={18} color={showPath ? T.green : T.white} />
          </TouchableOpacity>
          <TouchableOpacity style={{ backgroundColor: T.card, padding: 12, borderRadius: 24, borderWidth: 1, borderColor: T.border, alignItems: 'center', justifyContent: 'center' }} onPress={() => setTileStyle(s => (s === 'dark' ? 'default' : 'dark'))}>
            <Ionicons name={tileStyle === 'dark' ? 'moon' : 'sunny'} size={18} color={T.accent2} />
          </TouchableOpacity>
          <TouchableOpacity style={{ backgroundColor: T.card, padding: 12, borderRadius: 24, borderWidth: 1, borderColor: T.border, alignItems: 'center', justifyContent: 'center' }} onPress={recenter}>
            <Ionicons name="locate" size={18} color={T.text} />
          </TouchableOpacity>
        </View>

        {/* Bottom Floating Dashboard */}
        <AnimatedBlurView
          tint={themeName === 'light' ? 'light' : 'dark'}
          intensity={80}
          style={[
            {
              position: 'absolute',
              bottom: 90,
              left: 16,
              right: 16,
              borderRadius: 24,
              padding: 16,
              borderWidth: 1,
              borderColor: T.border,
              overflow: 'hidden',
              backgroundColor: T.surface + '80',
            },
            {
              opacity: panelAnim,
              transform: [{ translateY: panelAnim.interpolate({ inputRange: [0, 1], outputRange: [40, 0] }) }],
            },
          ]}
        >
          {/* Mini Stats */}
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
             <StatPill label={isMetric ? 'KM' : 'MI'} value={isMetric ? (distance / 1000).toFixed(2) : (distance / 1609.34).toFixed(2)} icon="trending-up" />
             <StatPill label="PACE" value={pace > 0 ? \`\${pace.toFixed(1)}'\` : '--'} icon="speedometer" />
             <StatPill label="AREA" value={isMetric ? \`\${Math.round(area)}m²\` : \`\${(area / 4046.856).toFixed(1)}ac\`} icon="square" />
          </View>

          {/* Action Row */}
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {state === 'idle' && (
              <TouchableOpacity style={{ flex: 1, borderRadius: 14, overflow: 'hidden' }} onPress={() => { if (settings?.vibrateOnAction) Vibration.vibrate(20); startRun(); }}>
                <LinearGradient colors={[T.green, '#00C6A0']} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, gap: 8 }} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                  <Ionicons name="play" size={20} color={T.black} />
                  <Text style={{ color: T.black, fontSize: 14, fontWeight: '900', letterSpacing: 1.5 }}>START</Text>
                </LinearGradient>
              </TouchableOpacity>
            )}

            {state === 'running' && (
              <>
                <TouchableOpacity style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: T.card, borderRadius: 14, borderWidth: 1, borderColor: T.border, paddingVertical: 14, gap: 6 }} onPress={() => { if (settings?.vibrateOnAction) Vibration.vibrate(20); pauseRun(); }}>
                  <Ionicons name="pause" size={18} color={T.white} />
                  <Text style={{ color: T.white, fontSize: 13, fontWeight: '800', letterSpacing: 1 }}>PAUSE</Text>
                </TouchableOpacity>
                <TouchableOpacity style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: T.red + '20', borderRadius: 14, borderWidth: 1, borderColor: T.red + '60', paddingVertical: 14, gap: 6 }} onPress={() => { if (settings?.vibrateOnAction) Vibration.vibrate(30); stopRun(); }}>
                  <Ionicons name="stop" size={18} color={T.red} />
                  <Text style={{ color: T.red, fontSize: 13, fontWeight: '800', letterSpacing: 1 }}>FINISH</Text>
                </TouchableOpacity>
              </>
            )}

            {state === 'paused' && (
              <>
                <TouchableOpacity style={{ flex: 1, borderRadius: 14, overflow: 'hidden' }} onPress={() => { if (settings?.vibrateOnAction) Vibration.vibrate(20); resumeRun(); }}>
                  <LinearGradient colors={[T.green, '#00C6A0']} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, gap: 8 }} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                    <Ionicons name="play" size={18} color={T.black} />
                    <Text style={{ color: T.black, fontSize: 14, fontWeight: '900', letterSpacing: 1.5 }}>RESUME</Text>
                  </LinearGradient>
                </TouchableOpacity>
                <TouchableOpacity style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: T.red + '20', borderRadius: 14, borderWidth: 1, borderColor: T.red + '60', paddingVertical: 14, gap: 6 }} onPress={stopRun}>
                  <Text style={{ color: T.red, fontSize: 13, fontWeight: '800', letterSpacing: 1 }}>FINISH</Text>
                </TouchableOpacity>
              </>
            )}

            {state === 'finished' && (
              <>
                <TouchableOpacity style={[{ flex: 1, borderRadius: 14, overflow: 'hidden' }, !closedLoop && { opacity: 0.5 }]} onPress={onClaim} disabled={!closedLoop}>
                  <LinearGradient colors={closedLoop ? [T.green, '#00C6A0'] : [T.muted, T.muted]} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, gap: 8 }} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                    <Ionicons name="flag" size={18} color={closedLoop ? T.black : T.text} />
                    <Text style={{ color: closedLoop ? T.black : T.text, fontSize: 14, fontWeight: '900', letterSpacing: 1.5 }}>{closedLoop ? 'CLAIM' : 'NO LOOP'}</Text>
                  </LinearGradient>
                </TouchableOpacity>
                <TouchableOpacity style={{ width: 50, alignItems: 'center', justifyContent: 'center', backgroundColor: T.card, borderRadius: 14, borderWidth: 1, borderColor: T.border }} onPress={onShareSummary}>
                  <Ionicons name="share-outline" size={16} color={T.accent2} />
                </TouchableOpacity>
                <TouchableOpacity style={{ width: 50, alignItems: 'center', justifyContent: 'center', backgroundColor: T.card, borderRadius: 14, borderWidth: 1, borderColor: T.border }} onPress={reset}>
                  <Ionicons name="refresh" size={18} color={T.text} />
                </TouchableOpacity>
              </>
            )}
          </View>
        </AnimatedBlurView>
      </View>`;

const topBarIdx = lines.findIndex(l => l.includes('{/* Top bar */}'));
const milestoneIdx = lines.findIndex(l => l.includes('{/* Milestone toast */}'));

if (topBarIdx !== -1 && milestoneIdx !== -1) {
    const updated = [
        ...lines.slice(0, topBarIdx),
        newBlock,
        ...lines.slice(milestoneIdx)
    ];
    fs.writeFileSync('c:/Users/PC/Documents/trae_projects/world_map/src/screens/RunScreen.tsx', updated.join('\n'));
    console.log("SUCCESSFULLY PATCHED");
} else {
    console.log("ERROR: Could not find boundaries. topBarIdx:", topBarIdx, "milestoneIdx:", milestoneIdx);
}
