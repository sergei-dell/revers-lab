import { Revers2 } from "@/components/Revers2";
import { ApertureMark } from "@/components/icons";

/*  ГЛАВНЫЙ И ЕДИНСТВЕННЫЙ ЭКРАН.

    Раньше здесь жил разбор ролика на промпт, кадры, метрики и ДНК.
    Проверка показала, что работает только один путь — «поверх
    оригинала»: трендовый ролик уходит в Seedance видео-основой и
    задаёт всё движение, а подменяются лицо, тело, одежда, место и
    товар. Всё остальное убрано; история осталась в git.           */

export default function Page() {
  return (
    <div className="relative min-h-screen overflow-x-hidden">
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-void" />
        <div className="stage-grid absolute inset-x-0 top-0 h-[520px]" />
        <div
          className="absolute -left-40 top-[-10rem] h-[30rem] w-[30rem] rounded-full opacity-[0.14] blur-[110px]"
          style={{ background: "radial-gradient(circle,#ff6a2b 0%,transparent 70%)" }}
        />
      </div>

      <header className="sticky top-0 z-40 border-b border-line-soft bg-void/82 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-[1420px] items-center gap-4 px-4 py-3 sm:px-6">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-ember/40 bg-ember/10 text-ember">
            <ApertureMark width={20} height={20} />
          </span>
          <div className="leading-none">
            <p className="font-display text-[17px] font-bold uppercase tracking-[0.18em] text-chalk">
              Реверс
            </p>
            <p className="mt-1 font-mono text-[9.5px] uppercase tracking-[0.16em] text-dim">
              поверх оригинала
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1420px] px-4 pb-14 pt-5 sm:px-6">
        <Revers2 />
      </main>

      <footer className="border-t border-line-soft bg-ink/60">
        <div className="mx-auto w-full max-w-[1420px] px-4 py-5 sm:px-6">
          <p className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-dim">
            Реверс · ролик-тренд → видео-основа → шаблон → витрина
          </p>
        </div>
      </footer>
    </div>
  );
}
