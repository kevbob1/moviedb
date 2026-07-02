'use client';

import { Switch } from '@/components/ui/Switch';

interface ShowFulfilledSwitchProps {
  defaultChecked: boolean;
  query: string;
}

export function ShowFulfilledSwitch({ defaultChecked, query }: ShowFulfilledSwitchProps) {
  return (
    <div className="flex items-center gap-3">
      <Switch
        defaultChecked={defaultChecked}
        label="Show fulfilled"
        onCheckedChange={(checked) => {
          const params = new URLSearchParams();
          if (query) params.set('q', query);
          if (checked) params.set('showFulfilled', 'true');
          window.location.search = params.toString();
        }}
      />
    </div>
  );
}
