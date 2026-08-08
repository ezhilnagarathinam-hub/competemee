import { useState } from 'react';
import { MessageCircle, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { waLink } from '@/lib/whatsapp';

export interface WhatsAppRecipient {
  id: string;
  name: string;
  phone: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  recipients: WhatsAppRecipient[];
  buildMessage: (recipient: WhatsAppRecipient) => string;
  /** Generic text for pasting into a WhatsApp group */
  groupMessage?: string;
}

export function WhatsAppNotifyDialog({
  open,
  onOpenChange,
  title,
  description,
  recipients,
  buildMessage,
  groupMessage,
}: Props) {
  const [sent, setSent] = useState<Set<string>>(new Set());

  function markSent(id: string) {
    setSent((prev) => new Set(prev).add(id));
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-card max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display">{title}</DialogTitle>
          <DialogDescription>
            {description || 'Each message opens in WhatsApp with the text ready — tap send there.'}
          </DialogDescription>
        </DialogHeader>

        {groupMessage && (
          <Button
            variant="outline"
            className="w-full border-primary/30"
            onClick={() => {
              navigator.clipboard.writeText(groupMessage);
              toast.success('Message copied — paste it into your WhatsApp group');
            }}
          >
            <Copy className="w-4 h-4 mr-2" /> Copy message for a WhatsApp group
          </Button>
        )}

        {recipients.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No players to notify yet.</p>
        ) : (
          <div className="max-h-[50vh] overflow-y-auto space-y-2 pr-1">
            {recipients.map((r) => {
              const isSent = sent.has(r.id);
              const message = buildMessage(r);
              return (
                <div
                  key={r.id}
                  className={`flex items-center gap-2 p-3 rounded-xl border border-border bg-muted/30 ${
                    isSent ? 'opacity-50' : ''
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-sm text-foreground truncate">{r.name}</p>
                    <p className="text-xs text-muted-foreground">{r.phone || 'No phone number'}</p>
                  </div>

                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      navigator.clipboard.writeText(message);
                      toast.success('Message copied');
                    }}
                  >
                    <Copy className="w-4 h-4" />
                  </Button>

                  {r.phone ? (
                    <a
                      href={waLink(r.phone, message)}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => markSent(r.id)}
                    >
                      <Button size="sm" className="gradient-primary text-primary-foreground">
                        {isSent ? <Check className="w-4 h-4" /> : <MessageCircle className="w-4 h-4" />}
                      </Button>
                    </a>
                  ) : (
                    <Button size="sm" disabled variant="outline">
                      <MessageCircle className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
