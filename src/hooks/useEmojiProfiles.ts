import sushiDataJSON from "../assets/sushiyuki.json";
import mahjongDataJSON from "../assets/mahjong.json";

const sushiData = sushiDataJSON;
const sushiDataLength = sushiData.length;
const mahjongData = mahjongDataJSON;
const mahjongDataLength = mahjongData.length;

const characters = [...sushiData, ...mahjongData];

const profileRandom = new Date().getUTCDate() + new Date().getUTCMonth();

type Profile = {
  pubkey: string,
  picture: string,
  display_name: string,
  name: string,
  created_at: number,
};

export function getRandomProfile(pubkey: string, sushiMode: Boolean = false, mahjongMode: Boolean = false): Profile {
  const pubkeyNumber = profileRandom + parseInt(pubkey.substring(0, 3), 29);

  let randomNumber = 0;
  if (sushiMode && mahjongMode) {
    randomNumber = pubkeyNumber % (sushiDataLength + mahjongDataLength);
  } else if (sushiMode) {
    randomNumber = pubkeyNumber % sushiDataLength;
  } else if (mahjongMode) {
    randomNumber = sushiDataLength + (pubkeyNumber % mahjongDataLength);
  } else {
    randomNumber = pubkeyNumber % characters.length;
  }
  const c = characters[randomNumber];
  const p: Profile = {
    pubkey: "",
    picture: c.picture,
    display_name: c.display_name,
    name: c.name,
    created_at: 0,
  }
  return p;
}

export default { }