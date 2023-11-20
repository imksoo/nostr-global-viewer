import actionMP3 from '../assets/action.mp3';
import reactionMP3 from '../assets/reaction.mp3';
import etwsMP3 from '../assets/etws.mp3';

const actionSound = new Audio(actionMP3);
const reactionSound = new Audio(reactionMP3);
const etwsSound = new Audio(etwsMP3);

function playSound(target: HTMLAudioElement): void {
  if (target.paused) {
    target.currentTime = 0;
    target.play();
  }
}

export function playActionSound() {
  playSound(actionSound);
}

export function playReactionSound() {
  playSound(reactionSound);
}

export function playETWSSound() {
  playSound(etwsSound);
}

export default {
  playActionSound : playActionSound,
  playReactionSound : playReactionSound,
  playETWSSound : playReactionSound,
}