import type { ServiceRefusal } from '../../../packages/game/public/personnel-query-types.ts';
import type {
  CampaignSnapshot,
  CampaignAction,
} from '../../../packages/game/public/campaign-types.ts';
import { rosterFor } from '../../../packages/game/campaign.js';
import { guaranteeDepartureReason } from '../../../packages/game/service-guarantees.js';
import { operativeInTransit } from '../../../packages/game/squads.js';

export default function ServiceRefusalNotice({
  state,
  refusal,
  disabled = false,
  dispatch,
}: {
  state: CampaignSnapshot;
  refusal: ServiceRefusal | null | undefined;
  disabled?: boolean;
  dispatch: (action: CampaignAction) => void;
}) {
  if (!refusal) {
    return null;
  }
  const currentContract = state.contracts[refusal.rivalId];
  const moving = operativeInTransit(state, refusal.rivalId),
    refundReason = guaranteeDepartureReason(
      state,
      state.contracts?.[refusal.rivalId],
      rosterFor(state).find((o) => o.id === refusal.rivalId),
    ),
    blocked =
      disabled || moving || refusal.rivalId === 1000 || Boolean(refundReason);
  return (
    <div aria-live="polite" className="service-refusal">
      <p>{refusal.reason}</p>
      <p>
        Podés conservar a {refusal.rivalName} o finalizar su servicio. El
        rechazo no acorta los contratos ya pagados.
      </p>
      {refundReason && !moving && <p>{refundReason}</p>}
      <button
        type="button"
        className="line-button"
        disabled={blocked}
        title={
          moving
            ? 'Esperá a que llegue antes de finalizar su servicio.'
            : refundReason || undefined
        }
        onClick={() =>
          dispatch({
            type: 'dismiss',
            id: refusal.rivalId,
            ...(currentContract?.guaranteeId
              ? {
                  expectedGuaranteeId: currentContract.guaranteeId,
                }
              : {}),
          })
        }
      >
        Finalizar servicio de {refusal.rivalName}
      </button>
    </div>
  );
}
