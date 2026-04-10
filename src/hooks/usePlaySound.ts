let actionSound: HTMLAudioElement | null = null;
let reactionSound: HTMLAudioElement | null = null;
let etwsSound: HTMLAudioElement | null = null;

function playSound(target: HTMLAudioElement): void {
  if (target.paused) {
    target.currentTime = 0;
    target.play();
  }
}

export async function playActionSound() {
  if (!actionSound) {
    const { default: url } = await import('../assets/action.mp3');
    actionSound = new Audio(url);
  }
  playSound(actionSound);
}

export async function playReactionSound() {
  if (!reactionSound) {
    const { default: url } = await import('../assets/reaction.mp3');
    reactionSound = new Audio(url);
  }
  playSound(reactionSound);
}

export async function playETWSSound() {
  if (!etwsSound) {
    const { default: url } = await import('../assets/etws.mp3');
    etwsSound = new Audio(url);
  }
  playSound(etwsSound);
}

export default {
  playActionSound,
  playReactionSound,
  playETWSSound,
}
