import type { ReactElement } from "react"
import type { Icon as PhosphorIcon, IconProps as PhosphorIconProps } from "@phosphor-icons/react"
import { ArchiveIcon as PhosphorArchive } from "@phosphor-icons/react/dist/ssr/Archive"
import { ArrowCounterClockwiseIcon as PhosphorArrowCounterClockwise } from "@phosphor-icons/react/dist/ssr/ArrowCounterClockwise"
import { ArrowDownIcon as PhosphorArrowDown } from "@phosphor-icons/react/dist/ssr/ArrowDown"
import { ArrowLeftIcon as PhosphorArrowLeft } from "@phosphor-icons/react/dist/ssr/ArrowLeft"
import { ArrowRightIcon as PhosphorArrowRight } from "@phosphor-icons/react/dist/ssr/ArrowRight"
import { ArrowSquareOutIcon as PhosphorArrowSquareOut } from "@phosphor-icons/react/dist/ssr/ArrowSquareOut"
import { ArrowUpIcon as PhosphorArrowUp } from "@phosphor-icons/react/dist/ssr/ArrowUp"
import { ArrowUpRightIcon as PhosphorArrowUpRight } from "@phosphor-icons/react/dist/ssr/ArrowUpRight"
import { ArrowsClockwiseIcon as PhosphorArrowsClockwise } from "@phosphor-icons/react/dist/ssr/ArrowsClockwise"
import { ArrowsOutSimpleIcon as PhosphorArrowsOutSimple } from "@phosphor-icons/react/dist/ssr/ArrowsOutSimple"
import { BellIcon as PhosphorBell } from "@phosphor-icons/react/dist/ssr/Bell"
import { BookOpenIcon as PhosphorBookOpen } from "@phosphor-icons/react/dist/ssr/BookOpen"
import { BookmarkSimpleIcon as PhosphorBookmarkSimple } from "@phosphor-icons/react/dist/ssr/BookmarkSimple"
import { BriefcaseIcon as PhosphorBriefcase } from "@phosphor-icons/react/dist/ssr/Briefcase"
import { BroadcastIcon as PhosphorBroadcast } from "@phosphor-icons/react/dist/ssr/Broadcast"
import { BuildingsIcon as PhosphorBuildings } from "@phosphor-icons/react/dist/ssr/Buildings"
import { CalendarBlankIcon as PhosphorCalendarBlank } from "@phosphor-icons/react/dist/ssr/CalendarBlank"
import { CalendarDotsIcon as PhosphorCalendarDots } from "@phosphor-icons/react/dist/ssr/CalendarDots"
import { CalendarPlusIcon as PhosphorCalendarPlus } from "@phosphor-icons/react/dist/ssr/CalendarPlus"
import { CameraIcon as PhosphorCamera } from "@phosphor-icons/react/dist/ssr/Camera"
import { CaretDownIcon as PhosphorCaretDown } from "@phosphor-icons/react/dist/ssr/CaretDown"
import { CaretLeftIcon as PhosphorCaretLeft } from "@phosphor-icons/react/dist/ssr/CaretLeft"
import { CaretRightIcon as PhosphorCaretRight } from "@phosphor-icons/react/dist/ssr/CaretRight"
import { CaretUpIcon as PhosphorCaretUp } from "@phosphor-icons/react/dist/ssr/CaretUp"
import { CaretUpDownIcon as PhosphorCaretUpDown } from "@phosphor-icons/react/dist/ssr/CaretUpDown"
import { ChartBarIcon as PhosphorChartBar } from "@phosphor-icons/react/dist/ssr/ChartBar"
import { ChartLineUpIcon as PhosphorChartLineUp } from "@phosphor-icons/react/dist/ssr/ChartLineUp"
import { ChatIcon as PhosphorChat } from "@phosphor-icons/react/dist/ssr/Chat"
import { ChatTextIcon as PhosphorChatText } from "@phosphor-icons/react/dist/ssr/ChatText"
import { CheckIcon as PhosphorCheck } from "@phosphor-icons/react/dist/ssr/Check"
import { CheckCircleIcon as PhosphorCheckCircle } from "@phosphor-icons/react/dist/ssr/CheckCircle"
import { ChecksIcon as PhosphorChecks } from "@phosphor-icons/react/dist/ssr/Checks"
import { CircleIcon as PhosphorCircle } from "@phosphor-icons/react/dist/ssr/Circle"
import { CircleNotchIcon as PhosphorCircleNotch } from "@phosphor-icons/react/dist/ssr/CircleNotch"
import { ClipboardTextIcon as PhosphorClipboardText } from "@phosphor-icons/react/dist/ssr/ClipboardText"
import { ClockIcon as PhosphorClock } from "@phosphor-icons/react/dist/ssr/Clock"
import { CloudArrowUpIcon as PhosphorCloudArrowUp } from "@phosphor-icons/react/dist/ssr/CloudArrowUp"
import { CompassIcon as PhosphorCompass } from "@phosphor-icons/react/dist/ssr/Compass"
import { ConfettiIcon as PhosphorConfetti } from "@phosphor-icons/react/dist/ssr/Confetti"
import { CopyIcon as PhosphorCopy } from "@phosphor-icons/react/dist/ssr/Copy"
import { DeviceMobileIcon as PhosphorDeviceMobile } from "@phosphor-icons/react/dist/ssr/DeviceMobile"
import { DoorOpenIcon as PhosphorDoorOpen } from "@phosphor-icons/react/dist/ssr/DoorOpen"
import { DotsSixVerticalIcon as PhosphorDotsSixVertical } from "@phosphor-icons/react/dist/ssr/DotsSixVertical"
import { DotsThreeIcon as PhosphorDotsThree } from "@phosphor-icons/react/dist/ssr/DotsThree"
import { DownloadIcon as PhosphorDownload } from "@phosphor-icons/react/dist/ssr/Download"
import { EnvelopeIcon as PhosphorEnvelope } from "@phosphor-icons/react/dist/ssr/Envelope"
import { EnvelopeOpenIcon as PhosphorEnvelopeOpen } from "@phosphor-icons/react/dist/ssr/EnvelopeOpen"
import { EyeIcon as PhosphorEye } from "@phosphor-icons/react/dist/ssr/Eye"
import { FileArrowDownIcon as PhosphorFileArrowDown } from "@phosphor-icons/react/dist/ssr/FileArrowDown"
import { FileTextIcon as PhosphorFileText } from "@phosphor-icons/react/dist/ssr/FileText"
import { GearIcon as PhosphorGear } from "@phosphor-icons/react/dist/ssr/Gear"
import { GlobeIcon as PhosphorGlobe } from "@phosphor-icons/react/dist/ssr/Globe"
import { GraduationCapIcon as PhosphorGraduationCap } from "@phosphor-icons/react/dist/ssr/GraduationCap"
import { HeartIcon as PhosphorHeart } from "@phosphor-icons/react/dist/ssr/Heart"
import { HouseIcon as PhosphorHouse } from "@phosphor-icons/react/dist/ssr/House"
import { IdentificationCardIcon as PhosphorIdentificationCard } from "@phosphor-icons/react/dist/ssr/IdentificationCard"
import { ImageIcon as PhosphorImage } from "@phosphor-icons/react/dist/ssr/Image"
import { ImageSquareIcon as PhosphorImageSquare } from "@phosphor-icons/react/dist/ssr/ImageSquare"
import { InfoIcon as PhosphorInfo } from "@phosphor-icons/react/dist/ssr/Info"
import { InstagramLogoIcon as PhosphorInstagramLogo } from "@phosphor-icons/react/dist/ssr/InstagramLogo"
import { LightbulbIcon as PhosphorLightbulb } from "@phosphor-icons/react/dist/ssr/Lightbulb"
import { LightningIcon as PhosphorLightning } from "@phosphor-icons/react/dist/ssr/Lightning"
import { LinkIcon as PhosphorLink } from "@phosphor-icons/react/dist/ssr/Link"
import { LinkedinLogoIcon as PhosphorLinkedinLogo } from "@phosphor-icons/react/dist/ssr/LinkedinLogo"
import { ListIcon as PhosphorList } from "@phosphor-icons/react/dist/ssr/List"
import { ListChecksIcon as PhosphorListChecks } from "@phosphor-icons/react/dist/ssr/ListChecks"
import { LockKeyIcon as PhosphorLockKey } from "@phosphor-icons/react/dist/ssr/LockKey"
import { LockSimpleIcon as PhosphorLockSimple } from "@phosphor-icons/react/dist/ssr/LockSimple"
import { LockSimpleOpenIcon as PhosphorLockSimpleOpen } from "@phosphor-icons/react/dist/ssr/LockSimpleOpen"
import { MagnifyingGlassIcon as PhosphorMagnifyingGlass } from "@phosphor-icons/react/dist/ssr/MagnifyingGlass"
import { MapPinIcon as PhosphorMapPin } from "@phosphor-icons/react/dist/ssr/MapPin"
import { MapTrifoldIcon as PhosphorMapTrifold } from "@phosphor-icons/react/dist/ssr/MapTrifold"
import { MegaphoneIcon as PhosphorMegaphone } from "@phosphor-icons/react/dist/ssr/Megaphone"
import { MinusIcon as PhosphorMinus } from "@phosphor-icons/react/dist/ssr/Minus"
import { MonitorIcon as PhosphorMonitor } from "@phosphor-icons/react/dist/ssr/Monitor"
import { MountainsIcon as PhosphorMountains } from "@phosphor-icons/react/dist/ssr/Mountains"
import { NoteIcon as PhosphorNote } from "@phosphor-icons/react/dist/ssr/Note"
import { NotePencilIcon as PhosphorNotePencil } from "@phosphor-icons/react/dist/ssr/NotePencil"
import { PaletteIcon as PhosphorPalette } from "@phosphor-icons/react/dist/ssr/Palette"
import { PaperPlaneTiltIcon as PhosphorPaperPlaneTilt } from "@phosphor-icons/react/dist/ssr/PaperPlaneTilt"
import { PauseIcon as PhosphorPause } from "@phosphor-icons/react/dist/ssr/Pause"
import { PencilIcon as PhosphorPencil } from "@phosphor-icons/react/dist/ssr/Pencil"
import { PlayIcon as PhosphorPlay } from "@phosphor-icons/react/dist/ssr/Play"
import { PlusIcon as PhosphorPlus } from "@phosphor-icons/react/dist/ssr/Plus"
import { QuestionIcon as PhosphorQuestion } from "@phosphor-icons/react/dist/ssr/Question"
import { RowsIcon as PhosphorRows } from "@phosphor-icons/react/dist/ssr/Rows"
import { ShieldIcon as PhosphorShield } from "@phosphor-icons/react/dist/ssr/Shield"
import { ShieldCheckIcon as PhosphorShieldCheck } from "@phosphor-icons/react/dist/ssr/ShieldCheck"
import { ShieldWarningIcon as PhosphorShieldWarning } from "@phosphor-icons/react/dist/ssr/ShieldWarning"
import { ShuffleIcon as PhosphorShuffle } from "@phosphor-icons/react/dist/ssr/Shuffle"
import { SidebarSimpleIcon as PhosphorSidebarSimple } from "@phosphor-icons/react/dist/ssr/SidebarSimple"
import { SignInIcon as PhosphorSignIn } from "@phosphor-icons/react/dist/ssr/SignIn"
import { SignOutIcon as PhosphorSignOut } from "@phosphor-icons/react/dist/ssr/SignOut"
import { SlidersHorizontalIcon as PhosphorSlidersHorizontal } from "@phosphor-icons/react/dist/ssr/SlidersHorizontal"
import { SparkleIcon as PhosphorSparkle } from "@phosphor-icons/react/dist/ssr/Sparkle"
import { SquaresFourIcon as PhosphorSquaresFour } from "@phosphor-icons/react/dist/ssr/SquaresFour"
import { StackIcon as PhosphorStack } from "@phosphor-icons/react/dist/ssr/Stack"
import { TableIcon as PhosphorTable } from "@phosphor-icons/react/dist/ssr/Table"
import { TrashIcon as PhosphorTrash } from "@phosphor-icons/react/dist/ssr/Trash"
import { TriangleIcon as PhosphorTriangle } from "@phosphor-icons/react/dist/ssr/Triangle"
import { TrophyIcon as PhosphorTrophy } from "@phosphor-icons/react/dist/ssr/Trophy"
import { UploadIcon as PhosphorUpload } from "@phosphor-icons/react/dist/ssr/Upload"
import { UserIcon as PhosphorUser } from "@phosphor-icons/react/dist/ssr/User"
import { UserGearIcon as PhosphorUserGear } from "@phosphor-icons/react/dist/ssr/UserGear"
import { UserPlusIcon as PhosphorUserPlus } from "@phosphor-icons/react/dist/ssr/UserPlus"
import { UsersIcon as PhosphorUsers } from "@phosphor-icons/react/dist/ssr/Users"
import { VideoCameraIcon as PhosphorVideoCamera } from "@phosphor-icons/react/dist/ssr/VideoCamera"
import { WarningIcon as PhosphorWarning } from "@phosphor-icons/react/dist/ssr/Warning"
import { XIcon as PhosphorX } from "@phosphor-icons/react/dist/ssr/X"
import { XCircleIcon as PhosphorXCircle } from "@phosphor-icons/react/dist/ssr/XCircle"

export type IconProps = PhosphorIconProps & { title?: string }
export type IconComponent = (props: IconProps) => ReactElement

/** Native SVGs with no client context, safe in both Server and Client Components.
 * Keep shared sizing, ref forwarding, selectors, and decorative defaults.
 * Use regular for controls and fill for selected destinations or saved items.
 */
function createIcon(name: string, Glyph: PhosphorIcon): IconComponent {
  function Icon({ size = 24, color = "currentColor", weight = "regular", className, title, alt, children, ...props }: IconProps) {
    const label = title ?? alt
    const named = Boolean(label || props["aria-label"] || props["aria-labelledby"])
    return (
      <Glyph
        size={size}
        color={color}
        weight={weight}
        alt={label}
        focusable="false"
        aria-hidden={named ? undefined : true}
        role={named ? "img" : undefined}
        className={className ? `oc-icon ${className}` : "oc-icon"}
        data-icon-pack="phosphor"
        data-icon={name}
        data-icon-weight={weight}
        {...props}
      >
        {children}
      </Glyph>
    )
  }
  Icon.displayName = name
  return Icon
}

// Semantic aliases keep callers stable; all geometry comes from Phosphor.
export const Archive = /* @__PURE__ */ createIcon("Archive", PhosphorArchive)
export const ArrowDown = /* @__PURE__ */ createIcon("ArrowDown", PhosphorArrowDown)
export const ArrowLeft = /* @__PURE__ */ createIcon("ArrowLeft", PhosphorArrowLeft)
export const ArrowRight = /* @__PURE__ */ createIcon("ArrowRight", PhosphorArrowRight)
export const ArrowUp = /* @__PURE__ */ createIcon("ArrowUp", PhosphorArrowUp)
export const ArrowUpRight = /* @__PURE__ */ createIcon("ArrowUpRight", PhosphorArrowUpRight)
export const BarChart3 = /* @__PURE__ */ createIcon("BarChart3", PhosphorChartBar)
export const Bell = /* @__PURE__ */ createIcon("Bell", PhosphorBell)
export const BookOpen = /* @__PURE__ */ createIcon("BookOpen", PhosphorBookOpen)
export const Bookmark = /* @__PURE__ */ createIcon("Bookmark", PhosphorBookmarkSimple)
export const BookmarkCheck = /* @__PURE__ */ createIcon("BookmarkCheck", PhosphorBookmarkSimple)
export const Briefcase = /* @__PURE__ */ createIcon("Briefcase", PhosphorBriefcase)
export const BriefcaseBusiness = /* @__PURE__ */ createIcon("BriefcaseBusiness", PhosphorBriefcase)
export const Building2 = /* @__PURE__ */ createIcon("Building2", PhosphorBuildings)
export const CalendarClock = /* @__PURE__ */ createIcon("CalendarClock", PhosphorCalendarDots)
export const CalendarDays = /* @__PURE__ */ createIcon("CalendarDays", PhosphorCalendarBlank)
export const CalendarPlus = /* @__PURE__ */ createIcon("CalendarPlus", PhosphorCalendarPlus)
export const Camera = /* @__PURE__ */ createIcon("Camera", PhosphorCamera)
export const ChartNoAxesColumnIncreasing = /* @__PURE__ */ createIcon("ChartNoAxesColumnIncreasing", PhosphorChartBar)
export const ChartNoAxesCombined = /* @__PURE__ */ createIcon("ChartNoAxesCombined", PhosphorChartLineUp)
export const Check = /* @__PURE__ */ createIcon("Check", PhosphorCheck)
export const CheckCheck = /* @__PURE__ */ createIcon("CheckCheck", PhosphorChecks)
export const CheckCircle2 = /* @__PURE__ */ createIcon("CheckCircle2", PhosphorCheckCircle)
export const CheckIcon = /* @__PURE__ */ createIcon("CheckIcon", PhosphorCheck)
export const ChevronDown = /* @__PURE__ */ createIcon("ChevronDown", PhosphorCaretDown)
export const ChevronDownIcon = /* @__PURE__ */ createIcon("ChevronDownIcon", PhosphorCaretDown)
export const ChevronLeft = /* @__PURE__ */ createIcon("ChevronLeft", PhosphorCaretLeft)
export const ChevronLeftIcon = /* @__PURE__ */ createIcon("ChevronLeftIcon", PhosphorCaretLeft)
export const ChevronRight = /* @__PURE__ */ createIcon("ChevronRight", PhosphorCaretRight)
export const ChevronRightIcon = /* @__PURE__ */ createIcon("ChevronRightIcon", PhosphorCaretRight)
export const ChevronUp = /* @__PURE__ */ createIcon("ChevronUp", PhosphorCaretUp)
export const ChevronUpIcon = /* @__PURE__ */ createIcon("ChevronUpIcon", PhosphorCaretUp)
export const ChevronsUpDown = /* @__PURE__ */ createIcon("ChevronsUpDown", PhosphorCaretUpDown)
export const Circle = /* @__PURE__ */ createIcon("Circle", PhosphorCircle)
export const CircleHelp = /* @__PURE__ */ createIcon("CircleHelp", PhosphorQuestion)
export const CircleIcon = /* @__PURE__ */ createIcon("CircleIcon", PhosphorCircle)
export const ClipboardCheck = /* @__PURE__ */ createIcon("ClipboardCheck", PhosphorClipboardText)
export const ClipboardList = /* @__PURE__ */ createIcon("ClipboardList", PhosphorClipboardText)
export const Clock = /* @__PURE__ */ createIcon("Clock", PhosphorClock)
export const Clock3 = /* @__PURE__ */ createIcon("Clock3", PhosphorClock)
export const Compass = /* @__PURE__ */ createIcon("Compass", PhosphorCompass)
export const Copy = /* @__PURE__ */ createIcon("Copy", PhosphorCopy)
export const DoorOpen = /* @__PURE__ */ createIcon("DoorOpen", PhosphorDoorOpen)
export const Download = /* @__PURE__ */ createIcon("Download", PhosphorDownload)
export const ExternalLink = /* @__PURE__ */ createIcon("ExternalLink", PhosphorArrowSquareOut)
export const Eye = /* @__PURE__ */ createIcon("Eye", PhosphorEye)
export const FileCheck2 = /* @__PURE__ */ createIcon("FileCheck2", PhosphorFileText)
export const FileDown = /* @__PURE__ */ createIcon("FileDown", PhosphorFileArrowDown)
export const FilePenLine = /* @__PURE__ */ createIcon("FilePenLine", PhosphorNotePencil)
export const FileText = /* @__PURE__ */ createIcon("FileText", PhosphorFileText)
export const Globe = /* @__PURE__ */ createIcon("Globe", PhosphorGlobe)
export const Globe2 = /* @__PURE__ */ createIcon("Globe2", PhosphorGlobe)
export const GraduationCap = /* @__PURE__ */ createIcon("GraduationCap", PhosphorGraduationCap)
export const GripVertical = /* @__PURE__ */ createIcon("GripVertical", PhosphorDotsSixVertical)
export const GripVerticalIcon = /* @__PURE__ */ createIcon("GripVerticalIcon", PhosphorDotsSixVertical)
export const Heart = /* @__PURE__ */ createIcon("Heart", PhosphorHeart)
export const Home = /* @__PURE__ */ createIcon("Home", PhosphorHouse)
export const IdCard = /* @__PURE__ */ createIcon("IdCard", PhosphorIdentificationCard)
export const ImageIcon = /* @__PURE__ */ createIcon("ImageIcon", PhosphorImage)
export const ImagePlus = /* @__PURE__ */ createIcon("ImagePlus", PhosphorImageSquare)
export const Info = /* @__PURE__ */ createIcon("Info", PhosphorInfo)
export const Instagram = /* @__PURE__ */ createIcon("Instagram", PhosphorInstagramLogo)
export const Layers = /* @__PURE__ */ createIcon("Layers", PhosphorStack)
export const LayoutGrid = /* @__PURE__ */ createIcon("LayoutGrid", PhosphorSquaresFour)
export const Lightbulb = /* @__PURE__ */ createIcon("Lightbulb", PhosphorLightbulb)
export const Link2 = /* @__PURE__ */ createIcon("Link2", PhosphorLink)
export const LinkIcon = /* @__PURE__ */ createIcon("LinkIcon", PhosphorLink)
export const Linkedin = /* @__PURE__ */ createIcon("Linkedin", PhosphorLinkedinLogo)
export const ListChecks = /* @__PURE__ */ createIcon("ListChecks", PhosphorListChecks)
export const Loader2 = /* @__PURE__ */ createIcon("Loader2", PhosphorCircleNotch)
export const Loader2Icon = /* @__PURE__ */ createIcon("Loader2Icon", PhosphorCircleNotch)
export const LoaderCircle = /* @__PURE__ */ createIcon("LoaderCircle", PhosphorCircleNotch)
export const Lock = /* @__PURE__ */ createIcon("Lock", PhosphorLockSimple)
export const LockKeyhole = /* @__PURE__ */ createIcon("LockKeyhole", PhosphorLockKey)
export const LogIn = /* @__PURE__ */ createIcon("LogIn", PhosphorSignIn)
export const LogOut = /* @__PURE__ */ createIcon("LogOut", PhosphorSignOut)
export const Mail = /* @__PURE__ */ createIcon("Mail", PhosphorEnvelope)
export const MailOpen = /* @__PURE__ */ createIcon("MailOpen", PhosphorEnvelopeOpen)
export const MapPin = /* @__PURE__ */ createIcon("MapPin", PhosphorMapPin)
export const MapPinned = /* @__PURE__ */ createIcon("MapPinned", PhosphorMapTrifold)
export const Maximize2 = /* @__PURE__ */ createIcon("Maximize2", PhosphorArrowsOutSimple)
export const Megaphone = /* @__PURE__ */ createIcon("Megaphone", PhosphorMegaphone)
export const Menu = /* @__PURE__ */ createIcon("Menu", PhosphorList)
export const MessageSquare = /* @__PURE__ */ createIcon("MessageSquare", PhosphorChat)
export const MessageSquareText = /* @__PURE__ */ createIcon("MessageSquareText", PhosphorChatText)
export const MinusIcon = /* @__PURE__ */ createIcon("MinusIcon", PhosphorMinus)
export const Monitor = /* @__PURE__ */ createIcon("Monitor", PhosphorMonitor)
export const MoreHorizontal = /* @__PURE__ */ createIcon("MoreHorizontal", PhosphorDotsThree)
export const MoreHorizontalIcon = /* @__PURE__ */ createIcon("MoreHorizontalIcon", PhosphorDotsThree)
export const Mountain = /* @__PURE__ */ createIcon("Mountain", PhosphorMountains)
export const Palette = /* @__PURE__ */ createIcon("Palette", PhosphorPalette)
export const PanelLeftIcon = /* @__PURE__ */ createIcon("PanelLeftIcon", PhosphorSidebarSimple)
export const PartyPopper = /* @__PURE__ */ createIcon("PartyPopper", PhosphorConfetti)
export const Pause = /* @__PURE__ */ createIcon("Pause", PhosphorPause)
export const Pencil = /* @__PURE__ */ createIcon("Pencil", PhosphorPencil)
export const Play = /* @__PURE__ */ createIcon("Play", PhosphorPlay)
export const Plus = /* @__PURE__ */ createIcon("Plus", PhosphorPlus)
export const Radio = /* @__PURE__ */ createIcon("Radio", PhosphorBroadcast)
export const RefreshCw = /* @__PURE__ */ createIcon("RefreshCw", PhosphorArrowsClockwise)
export const RotateCcw = /* @__PURE__ */ createIcon("RotateCcw", PhosphorArrowCounterClockwise)
export const Rows3 = /* @__PURE__ */ createIcon("Rows3", PhosphorRows)
export const Search = /* @__PURE__ */ createIcon("Search", PhosphorMagnifyingGlass)
export const SearchIcon = /* @__PURE__ */ createIcon("SearchIcon", PhosphorMagnifyingGlass)
export const Send = /* @__PURE__ */ createIcon("Send", PhosphorPaperPlaneTilt)
export const Settings = /* @__PURE__ */ createIcon("Settings", PhosphorGear)
export const Settings2 = /* @__PURE__ */ createIcon("Settings2", PhosphorGear)
export const Shield = /* @__PURE__ */ createIcon("Shield", PhosphorShield)
export const ShieldAlert = /* @__PURE__ */ createIcon("ShieldAlert", PhosphorShieldWarning)
export const ShieldCheck = /* @__PURE__ */ createIcon("ShieldCheck", PhosphorShieldCheck)
export const Shuffle = /* @__PURE__ */ createIcon("Shuffle", PhosphorShuffle)
export const SlidersHorizontal = /* @__PURE__ */ createIcon("SlidersHorizontal", PhosphorSlidersHorizontal)
export const Smartphone = /* @__PURE__ */ createIcon("Smartphone", PhosphorDeviceMobile)
export const Sparkles = /* @__PURE__ */ createIcon("Sparkles", PhosphorSparkle)
export const StickyNote = /* @__PURE__ */ createIcon("StickyNote", PhosphorNote)
export const Table2 = /* @__PURE__ */ createIcon("Table2", PhosphorTable)
export const Trash2 = /* @__PURE__ */ createIcon("Trash2", PhosphorTrash)
export const Triangle = /* @__PURE__ */ createIcon("Triangle", PhosphorTriangle)
export const TriangleAlert = /* @__PURE__ */ createIcon("TriangleAlert", PhosphorWarning)
export const Trophy = /* @__PURE__ */ createIcon("Trophy", PhosphorTrophy)
export const Unlock = /* @__PURE__ */ createIcon("Unlock", PhosphorLockSimpleOpen)
export const Upload = /* @__PURE__ */ createIcon("Upload", PhosphorUpload)
export const UploadCloud = /* @__PURE__ */ createIcon("UploadCloud", PhosphorCloudArrowUp)
export const UserCog = /* @__PURE__ */ createIcon("UserCog", PhosphorUserGear)
export const UserPlus = /* @__PURE__ */ createIcon("UserPlus", PhosphorUserPlus)
export const UserRound = /* @__PURE__ */ createIcon("UserRound", PhosphorUser)
export const Users = /* @__PURE__ */ createIcon("Users", PhosphorUsers)
export const Users2 = /* @__PURE__ */ createIcon("Users2", PhosphorUsers)
export const Video = /* @__PURE__ */ createIcon("Video", PhosphorVideoCamera)
export const X = /* @__PURE__ */ createIcon("X", PhosphorX)
export const XCircle = /* @__PURE__ */ createIcon("XCircle", PhosphorXCircle)
export const XIcon = /* @__PURE__ */ createIcon("XIcon", PhosphorX)
export const Zap = /* @__PURE__ */ createIcon("Zap", PhosphorLightning)
