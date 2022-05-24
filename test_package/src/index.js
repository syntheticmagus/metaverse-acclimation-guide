import { runGame, VoiceOverTrack, SoundEffectTrack, Model, HdrEnvironment } from "app_package";

let assetsHostUrl;
if (DEV_BUILD) {
    assetsHostUrl = "http://127.0.0.1:8181";
} else {
    assetsHostUrl = "https://nonlocal-assets-host-url";
}

const ammoScript = document.createElement("script");
ammoScript.src = `${assetsHostUrl}/ammo/ammo.wasm.js`;
document.body.appendChild(ammoScript);

document.body.style.width = "100%";
document.body.style.height = "100%";
document.body.style.margin = "0";
document.body.style.padding = "0";

const title = document.createElement("p");
title.innerText = "Babylon.js NPM Package Template";
title.style.fontSize = "32pt";
title.style.textAlign = "center";
document.body.appendChild(title);

const div = document.createElement("div");
div.style.width = "60%";
div.style.margin = "0 auto";
div.style.aspectRatio = "16 / 9";
document.body.appendChild(div);

const canvas = document.createElement("canvas");
canvas.id = "renderCanvas";
canvas.style.width = "100%";
canvas.style.height = "100%";
canvas.style.display = "block";
div.appendChild(canvas);

const assetToUrl = new Map([
    [VoiceOverTrack.InvoluntaryFloorInspection, `${assetsHostUrl}/voiceover/00-involuntary_floor_inspection.mp3`],
    [VoiceOverTrack.PleaseRemainCalm, `${assetsHostUrl}/voiceover/01-please_remain_calm.mp3`],
    [VoiceOverTrack.AchievementsInCalmness, `${assetsHostUrl}/voiceover/02-achievements_in_calmness.mp3`],
    [VoiceOverTrack.UnactionableInformation, `${assetsHostUrl}/voiceover/03-unactionable_information.mp3`],
    [VoiceOverTrack.NoteworthyAchievements, `${assetsHostUrl}/voiceover/04-noteworthy_achievements.mp3`],
    [VoiceOverTrack.BanalitiesOfInteractions, `${assetsHostUrl}/voiceover/05-banalities_of_interactions.mp3`],
    [VoiceOverTrack.StaringAtTheFloor, `${assetsHostUrl}/voiceover/06-staring_at_the_floor.mp3`],
    [VoiceOverTrack.MoveTheMouseUp, `${assetsHostUrl}/voiceover/07-move_the_mouse_up.mp3`],
    [VoiceOverTrack.MouseLook, `${assetsHostUrl}/voiceover/08-mouse_look.mp3`],
    [VoiceOverTrack.WAsInWalk, `${assetsHostUrl}/voiceover/09-w_as_in_walk.mp3`],
    [VoiceOverTrack.ContainsOtherRooms, `${assetsHostUrl}/voiceover/10-contains_other_rooms.mp3`],
    [VoiceOverTrack.PressTheUnboundKey, `${assetsHostUrl}/voiceover/11-press_the_unbound_key.mp3`],
    [VoiceOverTrack.ExperienceMenu, `${assetsHostUrl}/voiceover/12-experience_menu.mp3`],
    [VoiceOverTrack.AvoidUsingMenus, `${assetsHostUrl}/voiceover/13-avoid_using_menus.mp3`],
    [VoiceOverTrack.KeyBindingsSubmenu, `${assetsHostUrl}/voiceover/14-key_bindings_submenu.mp3`],
    [VoiceOverTrack.Dvorak, `${assetsHostUrl}/voiceover/15-dvorak.mp3`],
    [VoiceOverTrack.Apply, `${assetsHostUrl}/voiceover/16-apply.mp3`],
    [VoiceOverTrack.InteractKey, `${assetsHostUrl}/voiceover/17-interact_key.mp3`],
    [VoiceOverTrack.TakeOnTheChallenges, `${assetsHostUrl}/voiceover/18-take_on_the_challenges.mp3`],
    [VoiceOverTrack.ThisIsAHallway, `${assetsHostUrl}/voiceover/19-this_is_a_hallway.mp3`],
    [VoiceOverTrack.OverlyLiteralInterpretation, `${assetsHostUrl}/voiceover/20-overly_literal_interpretation.mp3`],
    [VoiceOverTrack.DoorShapedWall, `${assetsHostUrl}/voiceover/21-door_shaped_wall.mp3`],
    [VoiceOverTrack.Congratulations, `${assetsHostUrl}/voiceover/22-congratulations.mp3`],

    [SoundEffectTrack.Music, `${assetsHostUrl}/sfx/todo.mp3`],
    [SoundEffectTrack.Click, `${assetsHostUrl}/sfx/todo.mp3`],
    [SoundEffectTrack.Footstep, `${assetsHostUrl}/sfx/todo.mp3`],
    [SoundEffectTrack.Hinge, `${assetsHostUrl}/sfx/todo.mp3`],
    [SoundEffectTrack.Elevator, `${assetsHostUrl}/sfx/todo.mp3`],

    [Model.MainLevel, `${assetsHostUrl}/level1.glb`],

    [HdrEnvironment.MainLevel, `${assetsHostUrl}/environment.env`],

    // TODO: GUI, etc.
]);

setTimeout(() => {
    Ammo().then(() => {
        runGame({ canvas: canvas, assetToUrl: assetToUrl });
    });
}, 1000);
