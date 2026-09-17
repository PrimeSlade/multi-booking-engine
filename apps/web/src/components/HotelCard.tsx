import { BedDouble, MapPin } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import type { Hotel } from '@/lib/api/types';
import { formatCurrency } from '@/lib/format';

export function HotelCard({
  hotel,
  selectedRoomIds,
  onToggleRoom,
}: {
  hotel: Hotel;
  selectedRoomIds: string[];
  onToggleRoom: (roomId: string) => void;
}) {
  return (
    <Card className="p-4">
      <div className="mb-3 flex items-center gap-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-secondary">
          <BedDouble className="size-4" />
        </div>
        <div>
          <p className="text-sm font-medium">{hotel.name}</p>
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            <MapPin className="size-3" />
            {hotel.city}
          </p>
        </div>
      </div>
      <div className="flex flex-col gap-2">
        {hotel.rooms.map((room) => {
          const selected = selectedRoomIds.includes(room.id);
          return (
            <button
              key={room.id}
              type="button"
              onClick={() => onToggleRoom(room.id)}
              className={`flex items-center justify-between rounded-md border px-3 py-2 text-left text-sm transition-colors ${
                selected
                  ? 'border-primary bg-secondary'
                  : 'border-border hover:bg-secondary'
              }`}
            >
              <span>{room.roomType}</span>
              <span className="flex items-center gap-2">
                <span className="text-muted-foreground">
                  {formatCurrency(room.price)}/night
                </span>
                <Badge
                  variant={selected ? undefined : 'outline'}
                  className={
                    selected ? 'bg-primary text-primary-foreground' : ''
                  }
                >
                  {selected ? 'Added' : 'Add'}
                </Badge>
              </span>
            </button>
          );
        })}
      </div>
    </Card>
  );
}
