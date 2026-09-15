import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { theme } from '../theme/theme';

export const ProfileScreen: React.FC = () => {
  const { user, signOut } = useAuth();

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out of KVJ FlowDesk?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: () => signOut() },
    ]);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.pageTitle}>Employee Profile</Text>
      <Text style={styles.pageSubtitle}>Identity & Account Configuration</Text>

      {/* User Info Card */}
      <View style={styles.card}>
        <View style={styles.avatarLarge}>
          <Text style={styles.avatarLargeText}>
            {(user?.firstName?.[0] || 'U').toUpperCase()}
            {(user?.lastName?.[0] || '').toUpperCase()}
          </Text>
        </View>

        <Text style={styles.userName}>{user?.fullName || 'Colleague'}</Text>
        <Text style={styles.userRole}>{user?.designation || 'Staff Member'}</Text>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Work Email</Text>
          <Text style={styles.infoValue}>{user?.email || '—'}</Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>System Role</Text>
          <Text style={styles.infoValue}>{(user?.role || 'employee').toUpperCase()}</Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Employee ID</Text>
          <Text style={styles.infoValue}>{user?.id?.slice(0, 12)}...</Text>
        </View>
      </View>

      {/* App Information */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>App Environment</Text>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>App Version</Text>
          <Text style={styles.infoValue}>1.0.0 (Expo SDK 52)</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Backend Cloud</Text>
          <Text style={styles.infoValue}>Supabase PostgreSQL (Live)</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Platform</Text>
          <Text style={styles.infoValue}>Cross-Platform (iOS & Android)</Text>
        </View>
      </View>

      {/* Logout Button */}
      <TouchableOpacity style={styles.logoutBtn} onPress={handleSignOut}>
        <Text style={styles.logoutBtnText}>🚪 Sign Out of Account</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    padding: theme.spacing.md,
  },
  pageTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: theme.colors.text,
  },
  pageSubtitle: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.md,
  },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: theme.spacing.md,
    alignItems: 'center',
  },
  avatarLarge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  avatarLargeText: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '800',
  },
  userName: {
    color: theme.colors.text,
    fontSize: 18,
    fontWeight: '700',
  },
  userRole: {
    color: theme.colors.primaryLight,
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 14,
  },
  sectionTitle: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: '700',
    alignSelf: 'flex-start',
    marginBottom: 10,
  },
  infoRow: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  infoLabel: {
    color: theme.colors.textSecondary,
    fontSize: 12,
  },
  infoValue: {
    color: theme.colors.text,
    fontSize: 12,
    fontWeight: '600',
  },
  logoutBtn: {
    backgroundColor: theme.colors.dangerBg,
    borderWidth: 1,
    borderColor: theme.colors.danger,
    borderRadius: theme.borderRadius.md,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 10,
  },
  logoutBtnText: {
    color: '#fca5a5',
    fontWeight: '700',
    fontSize: 14,
  },
});
