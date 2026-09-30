'use client';

import { Switch } from '@/components/ui/Switch';

interface ShowFulfilledSwitchProps {
  defaultChecked: boolean;
}

export function ShowFulfilledSwitch({ defaultChecked }: ShowFulfilledSwitchProps) {
  return (
    <div className="flex items-center gap-3">
      <Switch
        defaultChecked={defaultChecked}
        label="Show fulfilled"
        onCheckedChange={(checked) => {
          const params = new URLSearchParams();
          if (checked) params.set('showFulfilled', 'true');
          window.location.search = params.toString();
        }}
      />
    </div>
  );
}
