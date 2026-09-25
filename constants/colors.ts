export const COLORS = {
  primary: '#2E7D5B',       // Signal Green (verified/present + primary actions)
  background: '#F7F6F2',    // Warm off-white paper (clean, calm background)
  card: '#FFFFFF',          // Near-white (only where a true elevated surface is needed)
  textPrimary: '#14181F',   // Near-black ink (strong, readable primary text)
  textSecondary: '#5D6B7A', // Muted grey-blue (support text)
  textOnPrimary: '#FFFFFF', // White text on primary/green surfaces
  surface: '#EFF3F0',       // Subtle green-tinted surface (e.g. Header logo circle)
  border: '#DADFE3',        // Hairline (defines surfaces; replaces drop shadows)
  shadow: '#14181F',        // Ink (used for any remaining soft shading)
  warning: '#C97A2B',       // Amber (late/pending states)
  success: '#2E7D5B',       // Same signal green, named for its "present" use
  danger: '#B3261E',        // Red (errors)
} as const;