export enum VoiceOverTrack {
    _start,
    InvoluntaryFloorInspection,
    PleaseRemainCalm,
    AchievementsInCalmness,
    UnactionableInformation,
    NoteworthyAchievements,
    BanalitiesOfInteractions,
    StaringAtTheFloor,
    MoveTheMouseUp,
    MouseLook,
    WAsInWalk,
    ContainsOtherRooms,
    PressTheUnboundKey,
    ExperienceMenu,
    AvoidUsingMenus,
    KeyBindingsSubmenu,
    Dvorak,
    Apply,
    InteractKey,
    TakeOnTheChallenges,
    ThisIsAHallway,
    OverlyLiteralInterpretation,
    DoorShapedWall,
    Congratulations,
    _end,
}

export enum SoundEffectTrack {
    _start = VoiceOverTrack._end,
    Music,
    Click,
    Footstep,
    Hinge,
    Elevator,
    _end
}

export enum Model {
    _start = SoundEffectTrack._end,
    MainLevel,
    _end
}

export enum HdrEnvironment {
    _start = Model._end,
    MainLevel,
    _end
}

export enum GuiFile {
    _start = HdrEnvironment._end,
    Title,
    Game,
    Credits,
    _end
}

export interface IGameParams {
    canvas: HTMLCanvasElement;
    assetToUrl: Map<number, string>;
}
