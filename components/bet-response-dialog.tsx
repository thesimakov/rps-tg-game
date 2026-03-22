"use client"

import { useGame } from "@/lib/game-context"
import { formatAmount } from "@/lib/format-amount"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Coins, Check, X } from "lucide-react"
import { useI18n } from "@/lib/i18n/context"

export function BetResponseDialog() {
  const { t } = useI18n()
  const { betResponse, acceptBetResponse, declineBetResponse, toDisplayAmount, currencyLabel } = useGame()

  if (!betResponse) return null

  return (
    <Dialog open={!!betResponse} onOpenChange={(open) => !open && declineBetResponse()}>
      <DialogContent className="sm:max-w-md bg-card border-border" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>{t("betResponseTitle")}</DialogTitle>
          <DialogDescription>{t("betResponseBody")}</DialogDescription>
        </DialogHeader>
        <div className="flex items-center gap-4 py-4">
          <div className="w-14 h-14 rounded-2xl bg-primary/20 border border-primary/40 flex items-center justify-center text-xl font-bold text-primary">
            {betResponse.responderAvatar}
          </div>
          <div className="flex-1">
            <p className="font-bold text-base text-foreground">{betResponse.responderName}</p>
            <p className="text-sm text-muted-foreground">
              {t("betResponseWins", { n: betResponse.responderWins })}
            </p>
            <div className="flex items-center gap-1.5 mt-1">
              <Coins className="h-4 w-4 text-accent" />
              <span className="font-bold text-base text-accent tabular-nums">{formatAmount(toDisplayAmount(betResponse.amount))} {currencyLabel}</span>
            </div>
          </div>
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={declineBetResponse}
            className="gap-2"
          >
            <X className="h-4 w-4" />
            {t("betResponseDecline")}
          </Button>
          <Button
            onClick={acceptBetResponse}
            className="gap-2 bg-primary text-primary-foreground"
          >
            <Check className="h-4 w-4" />
            {t("betResponseAccept")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
