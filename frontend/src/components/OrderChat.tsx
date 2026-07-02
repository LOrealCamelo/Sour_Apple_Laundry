import { useCallback, useState } from "react";
import { View, Text, StyleSheet, Pressable, TextInput } from "react-native";
import { useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/src/api/client";
import { colors, spacing, radius } from "@/src/theme";

export default function OrderChat({ orderId, myRole }: { orderId: string; myRole: string }) {
  const [msgs, setMsgs] = useState<any[]>([]);
  const [text, setText] = useState("");
  const load = async () => { try { setMsgs(await api(`/orders/${orderId}/messages`)); } catch {} };
  useFocusEffect(useCallback(() => { load(); }, [orderId]));

  const send = async () => {
    if (!text.trim()) return;
    try { await api(`/orders/${orderId}/messages`, { method: "POST", body: { text } }); setText(""); await load(); }
    catch (e: any) { alert(e.message); }
  };
  const isMine = (r: string) => (myRole === "ADMIN" ? r === "ADMIN" : r !== "ADMIN");

  return (
    <View>
      {msgs.length === 0 && <Text style={styles.empty}>No messages yet. Send one to coordinate pickup 👋</Text>}
      {msgs.map((m) => (
        <View key={m.id} style={[styles.bubble, isMine(m.sender_role) ? styles.mine : styles.theirs]}>
          <Text style={styles.sender}>{m.sender_role === "ADMIN" ? "Sour Apple" : m.sender_name}</Text>
          <Text style={styles.msgText}>{m.text}</Text>
        </View>
      ))}
      <View style={styles.inputRow}>
        <TextInput testID="chat-input" value={text} onChangeText={setText} placeholder="Type a message…"
          placeholderTextColor={colors.textDim} style={styles.input} />
        <Pressable testID="chat-send" onPress={send} style={styles.sendBtn}><Ionicons name="send" size={18} color={colors.bg} /></Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  empty: { color: colors.textDim, fontSize: 13, marginBottom: spacing.sm },
  bubble: { maxWidth: "85%", padding: 10, borderRadius: radius.md, marginBottom: 8 },
  mine: { alignSelf: "flex-end", backgroundColor: colors.apple + "22", borderWidth: 1, borderColor: colors.apple },
  theirs: { alignSelf: "flex-start", backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.border },
  sender: { color: colors.textDim, fontSize: 11, marginBottom: 2, fontWeight: "700" },
  msgText: { color: colors.text, fontSize: 14 },
  inputRow: { flexDirection: "row", gap: 8, marginTop: spacing.sm },
  input: { flex: 1, backgroundColor: colors.surfaceAlt, borderRadius: radius.md, height: 44, paddingHorizontal: spacing.md, color: colors.text, borderWidth: 1, borderColor: colors.border },
  sendBtn: { width: 44, height: 44, borderRadius: radius.md, backgroundColor: colors.apple, alignItems: "center", justifyContent: "center" },
});
