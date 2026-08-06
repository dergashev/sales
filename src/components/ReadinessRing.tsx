/**
 * DC-26 · ReadinessChecklist — кольцо готовности.
 *
 * Кольцо считает не «прогресс вообще», а **готовность к встрече**: сколько
 * пунктов подготовки закрыто из тех, что нужны, чтобы показать оффер. Это
 * не то же самое, что процент заполненности формы, и подпись обязана
 * называть именно пункты, а не проценты — иначе продавец читает «73 %» и
 * не знает, чего не хватает.
 *
 * Носитель — число и список, кольцо иллюстрирует (правило 8): само кольцо
 * `aria-hidden`, доступное имя несёт регион.
 *
 * Геометрия окружности из системы (`--size-progress-ring`, `stroke-width`
 * в `.a3-ring .a3-fgc`); здесь только доля.
 */
export function ReadinessRing({ done, total, label }: {
  done: number
  total: number
  label: string
}) {
  const R = 20
  const circumference = 2 * Math.PI * R
  const share = total > 0 ? done / total : 0

  return (
    <div className="flex items-center gap-4" role="group" aria-label={label}>
      <div className="a3-ringwrap">
        <svg className="a3-ring" viewBox="0 0 48 48" aria-hidden="true">
          <circle className="a3-bgc" cx="24" cy="24" r={R} />
          <circle
            className="a3-fgc"
            cx="24" cy="24" r={R}
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - share)}
          />
        </svg>
        {/* Число внутри кольца — тоже иллюстрация: полная подпись рядом. */}
        <span className="a3-ringnum numeric" aria-hidden="true">{done}/{total}</span>
      </div>
      <p className="a3-cap">
        {done} von {total} Punkten erledigt
      </p>
    </div>
  )
}
