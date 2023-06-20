import actionMP3 from '../assets/action.mp3';
import reactionMP3 from '../assets/reaction.mp3';

const actionSound = new Audio(actionMP3);
const reactionSound = new Audio(reactionMP3);

function playSound(target: HTMLAudioElement): void {
  if (target.paused) {
    target.currentTime = 0;
    target.play();
  }
}

export function playActionSound() {
  playSound(actionSound);
}

export function playRectionSound() {
  playSound(reactionSound);
}

export default {
  playActionSound : playActionSound,
  playRectionSound : playRectionSound,
}