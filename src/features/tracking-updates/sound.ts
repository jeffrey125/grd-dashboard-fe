import { BroadcastChannel, createLeaderElection, type LeaderElector } from 'broadcast-channel';
import type { ReviewStore } from './review-store';

export class TrackingSound {
  private audio = new Audio('/sounds/kieffy-meow.m4a');
  private channel?: BroadcastChannel;
  private elector?: LeaderElector;
  private ready = false;
  private active = true;
  private eligible = false;
  private wasEnabled = false;
  constructor(
    private store: ReviewStore,
    private report: (message: string) => void,
  ) {
    this.audio.preload = 'auto';
  }

  async enable() {
    try {
      this.audio.currentTime = 0;
      await this.audio.play();
      if (!this.active) {
        this.audio.pause();
        return;
      }
      this.ready = true;
      this.report('');
      await this.store.setSound(true);
      this.reconcile(this.eligible);
    } catch {
      if (this.active)
        this.report('Sound could not play. Use the Tracking sound controls to try again.');
    }
  }

  reconcile(eligible: boolean) {
    this.eligible = eligible;
    const enabled = this.store.getSnapshot().sound;
    // Saved consent survives reload. The browser still enforces playback permission;
    // a denial disarms this tab until another explicit opt-in/test gesture.
    if (enabled && !this.wasEnabled) this.ready = true;
    this.wasEnabled = enabled;
    if (!eligible || !this.ready || !enabled) {
      this.release();
      return;
    }
    if (this.elector) return;
    try {
      this.channel = new BroadcastChannel(`${this.store.key}:audio`);
      this.elector = createLeaderElection(this.channel);
      this.elector.onduplicate = () => {
        this.release();
        this.report(
          'Sound coordination was interrupted. Select Enable sound in this tab to retry.',
        );
        this.ready = false;
      };
      void this.elector.awaitLeadership().catch(() => {
        if (this.active)
          this.report('Sound coordination is unavailable. Tracking highlights remain active.');
      });
    } catch {
      this.report('Sound coordination is unavailable. Tracking highlights remain active.');
    }
  }

  async play(snapshotIds: string[], stillEligible: () => boolean) {
    if (!this.active || !this.eligible || !this.elector?.isLeader) return;
    if (!(await this.store.claimSound(snapshotIds))) return;
    if (!this.active || !this.eligible || !stillEligible() || !this.store.getSnapshot().sound)
      return;
    try {
      this.audio.currentTime = 0;
      await this.audio.play();
    } catch {
      if (!this.active) return;
      this.ready = false;
      this.release();
      this.report('Sound was blocked. Select Enable sound in this tab to retry.');
    }
  }

  private release() {
    const elector = this.elector;
    const channel = this.channel;
    this.elector = undefined;
    this.channel = undefined;
    void elector
      ?.die()
      .then(() => channel?.close())
      .catch(() => undefined);
    this.audio.pause();
  }
  stop() {
    this.active = false;
    this.release();
    this.audio.removeAttribute('src');
  }
}
