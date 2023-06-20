import * as nostr from 'nostr-tools';

type Profile = {
  pubkey: string,
  picture: string,
  display_name: string,
  name: string,
  created_at: number,
};

const JAPANESE_REGEX = /[亜-熙ぁ-んァ-ヶ]/;

const synth = window.speechSynthesis;
export async function speakNote(event: nostr.Event, profile: Profile, waitTime: number = 1500) {
  setTimeout(() => {
    let display_name = profile.display_name ? profile.display_name : profile.name;
    if (display_name.match(JAPANESE_REGEX)) {
      display_name += "さん";
    } else {
      display_name += "-san";
    }

    let utterUserNameText = display_name;
    utterUserNameText = utterUserNameText
      .replace(/https?:\/\/[-_.!~*\'()a-zA-Z0-9;\/?:\@&=+\$,%#]+/g, "")
      .replace(
        /(?:[\u2700-\u27bf]|(?:\ud83c[\udde6-\uddff]){2}|[\ud800-\udbff][\udc00-\udfff]|[\u0023-\u0039]\ufe0f?\u20e3|\u3299|\u3297|\u303d|\u3030|\u24c2|\ud83c[\udd70-\udd71]|\ud83c[\udd7e-\udd7f]|\ud83c\udd8e|\ud83c[\udd91-\udd9a]|\ud83c[\udde6-\uddff]|[\ud83c[\ude01-\ude02]|\ud83c\ude1a|\ud83c\ude2f|[\ud83c[\ude32-\ude3a]|[\ud83c[\ude50-\ude51]|\u203c|\u2049|[\u25aa-\u25ab]|\u25b6|\u25c0|[\u25fb-\u25fe]|\u00a9|\u00ae|\u2122|\u2139|\ud83c\udc04|[\u2600-\u26FF]|\u2b05|\u2b06|\u2b07|\u2b1b|\u2b1c|\u2b50|\u2b55|\u231a|\u231b|\u2328|\u23cf|[\u23e9-\u23f3]|[\u23f8-\u23fa]|\ud83c\udccf|\u2934|\u2935|[\u2190-\u21ff])/g,
        ""
      );

    const utterUserName = new SpeechSynthesisUtterance(utterUserNameText);
    if (utterUserNameText.match(/[亜-熙ぁ-んァ-ヶ]/)) {
      utterUserName.lang = "ja-JP";
    } else {
      utterUserName.lang = "en-US";
    }
    utterUserName.volume = volume;
    synth.speak(utterUserName);

    let utterEventContent = event.content;
    utterEventContent = utterEventContent
      .replace(/https?:\/\/[-_.!~*\'()a-zA-Z0-9;\/?:\@&=+\$,%#]+/g, "")
      .replace(
        /(?:[\u2700-\u27bf]|(?:\ud83c[\udde6-\uddff]){2}|[\ud800-\udbff][\udc00-\udfff]|[\u0023-\u0039]\ufe0f?\u20e3|\u3299|\u3297|\u303d|\u3030|\u24c2|\ud83c[\udd70-\udd71]|\ud83c[\udd7e-\udd7f]|\ud83c\udd8e|\ud83c[\udd91-\udd9a]|\ud83c[\udde6-\uddff]|[\ud83c[\ude01-\ude02]|\ud83c\ude1a|\ud83c\ude2f|[\ud83c[\ude32-\ude3a]|[\ud83c[\ude50-\ude51]|\u203c|\u2049|[\u25aa-\u25ab]|\u25b6|\u25c0|[\u25fb-\u25fe]|\u00a9|\u00ae|\u2122|\u2139|\ud83c\udc04|[\u2600-\u26FF]|\u2b05|\u2b06|\u2b07|\u2b1b|\u2b1c|\u2b50|\u2b55|\u231a|\u231b|\u2328|\u23cf|[\u23e9-\u23f3]|[\u23f8-\u23fa]|\ud83c\udccf|\u2934|\u2935|[\u2190-\u21ff])/g,
        ""
      )
      .replace(/nostr:(nprofile|nrelay|nevent|naddr|nsec|npub|note)\S*/g, "");

    const utterContent = new SpeechSynthesisUtterance(utterEventContent);
    if (utterEventContent.match(/[亜-熙ぁ-んァ-ヶ]/)) {
      utterContent.lang = "ja-JP";
    } else {
      utterContent.lang = "en-US";
    }
    utterContent.volume = volume;
    synth.speak(utterContent);
  }, waitTime);
}

export let volume = 0.5;