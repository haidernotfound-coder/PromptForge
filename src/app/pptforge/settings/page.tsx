"use client";

import * as React from "react";
import { toast } from "sonner";
import { Settings as SettingsIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  PPTFORGE_STYLES,
  PPTFORGE_MIN_SLIDES,
  PPTFORGE_MAX_SLIDES,
  type PptForgeStyle,
} from "@/lib/pptforge";
import { getPptForgePrefs, setPptForgePrefs } from "@/lib/pptforge-history";

export default function PptForgeSettingsPage() {
  const [style, setStyle] = React.useState<PptForgeStyle>("professional");
  const [slideCount, setSlideCount] = React.useState(8);
  const [loaded, setLoaded] = React.useState(false);

  React.useEffect(() => {
    const prefs = getPptForgePrefs();
    setStyle(prefs.defaultStyle as PptForgeStyle);
    setSlideCount(prefs.defaultSlideCount);
    setLoaded(true);
  }, []);

  function save() {
    setPptForgePrefs({ defaultStyle: style, defaultSlideCount: slideCount });
    toast.success("Defaults saved on this device");
  }

  if (!loaded) return null;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center gap-2">
        <SettingsIcon className="h-5 w-5 text-text-muted" />
        <h1 className="font-display text-2xl font-semibold tracking-tight">Settings</h1>
      </div>
      <p className="text-sm text-text-muted">
        These defaults are stored locally in your browser and pre-fill the Generate form next time you open
        it — nothing here is sent to the server until you actually generate a deck.
      </p>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Default style & length</CardTitle>
          <CardDescription>Applied automatically on the Generate page.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-text-muted">Default style</label>
              <Select value={style} onValueChange={(v) => setStyle(v as PptForgeStyle)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PPTFORGE_STYLES.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-text-muted">
                Default slide count ({PPTFORGE_MIN_SLIDES}–{PPTFORGE_MAX_SLIDES})
              </label>
              <Input
                type="number"
                min={PPTFORGE_MIN_SLIDES}
                max={PPTFORGE_MAX_SLIDES}
                value={slideCount}
                onChange={(e) => {
                  const n = Number.parseInt(e.target.value, 10);
                  if (Number.isFinite(n)) {
                    setSlideCount(Math.min(PPTFORGE_MAX_SLIDES, Math.max(PPTFORGE_MIN_SLIDES, n)));
                  }
                }}
              />
            </div>
          </div>
          <Button onClick={save} size="sm">
            Save defaults
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
