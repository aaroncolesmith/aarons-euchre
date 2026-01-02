#!/bin/bash
TARGET="src/App.tsx"

# Text Colors
sed -i '' 's/text-emerald-800/text-brand-dark/g' $TARGET
sed -i '' 's/text-emerald-900/text-brand-dark/g' $TARGET
sed -i '' 's/text-emerald-700/text-brand-dark/g' $TARGET
sed -i '' 's/text-emerald-600/text-brand/g' $TARGET
sed -i '' 's/text-emerald-500/text-brand/g' $TARGET
sed -i '' 's/text-emerald-400/text-brand-dim/g' $TARGET
sed -i '' 's/text-emerald-300/text-brand-dim/g' $TARGET

sed -i '' 's/text-slate-800/text-ink/g' $TARGET
sed -i '' 's/text-slate-900/text-ink/g' $TARGET
sed -i '' 's/text-slate-500/text-ink-dim/g' $TARGET
sed -i '' 's/text-slate-400/text-ink-dim/g' $TARGET
sed -i '' 's/text-slate-300/text-ink-dim\/50/g' $TARGET

# Backgrounds
sed -i '' 's/bg-emerald-500/bg-brand/g' $TARGET
sed -i '' 's/bg-emerald-400/bg-brand-dim/g' $TARGET
sed -i '' 's/bg-emerald-50/bg-brand\/10/g' $TARGET
sed -i '' 's/bg-emerald-100/bg-brand\/20/g' $TARGET

sed -i '' 's/bg-white/bg-paper/g' $TARGET
sed -i '' 's/bg-slate-50/bg-paper-dim/g' $TARGET
sed -i '' 's/bg-slate-100/bg-paper-dim/g' $TARGET
sed -i '' 's/bg-slate-800/bg-ink/g' $TARGET
sed -i '' 's/bg-slate-900/bg-ink/g' $TARGET
sed -i '' 's/bg-slate-950/bg-ink/g' $TARGET

# Borders
sed -i '' 's/border-emerald-500/border-brand/g' $TARGET
sed -i '' 's/border-emerald-600/border-brand/g' $TARGET
sed -i '' 's/border-emerald-700/border-brand-dark/g' $TARGET
sed -i '' 's/border-emerald-200/border-brand-dim/g' $TARGET
sed -i '' 's/border-emerald-100/border-brand-dim\/50/g' $TARGET

sed -i '' 's/border-slate-800/border-ink/g' $TARGET
sed -i '' 's/border-slate-300/border-ink-dim/g' $TARGET
sed -i '' 's/border-slate-200/border-ink-dim\/50/g' $TARGET
sed -i '' 's/border-slate-100/border-paper-dim/g' $TARGET

# Shadows 
# Note: Escape [ and ] for sed regex if needed, but in single quotes it might be literal... 
# Actually [ is special in sed regex. We need to escape it.
sed -i '' 's/shadow-\[4px_4px_0px_0px_rgba(16,185,129,0.2)\]/shadow-sketch-brand/g' $TARGET
sed -i '' 's/shadow-\[4px_4px_0px_0px_rgba(30,41,59,1)\]/shadow-sketch-ink/g' $TARGET
sed -i '' 's/shadow-\[2px_2px_0px_0px_rgba(30,41,59,1)\]/shadow-sketch-ink/g' $TARGET
sed -i '' 's/shadow-\[6px_6px_0px_0px_rgba(30,41,59,1)\]/shadow-sketch-ink/g' $TARGET
sed -i '' 's/shadow-\[8px_8px_0px_0px_rgba(30,41,59,1)\]/shadow-sketch-ink/g' $TARGET
sed -i '' 's/shadow-\[12px_12px_0px_0px_rgba(30,41,59,1)\]/shadow-sketch-ink/g' $TARGET
sed -i '' 's/shadow-\[6px_6px_0px_0px_rgba(16,185,129,0.2)\]/shadow-sketch-brand/g' $TARGET
sed -i '' 's/shadow-\[0_0_30px_rgba(16,185,129,0.3)\]/shadow-sketch-brand/g' $TARGET # This was a glow, replacing with sketch shadow for now or maybe defining a glow variable later

echo "Refactor complete."
