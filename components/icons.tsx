import type { CSSProperties, ReactElement, SVGProps } from "react"

export type IconProps = SVGProps<SVGSVGElement> & {
  size?: number | string
  title?: string
}

export type IconComponent = (props: IconProps) => ReactElement

/**
 * Icons8 Material Outlined, drawn on a 24px grid. The local 96px PNG is an
 * alpha mask: the SVG keeps existing sizing/selectors/ref support, while its
 * currentColor rectangle follows the surrounding text, including hover states.
 * SVG downloads require an Icons8 plan with MCP API access; PNGs up to 100px
 * are available with attribution. See icons8.json and docs/icons.md.
 */
function createIcon(name: string, id: string): IconComponent {
  function Icon({ size = 24, color = "currentColor", className, style, title, children, ...props }: IconProps) {
    const named = Boolean(title || props["aria-label"] || props["aria-labelledby"])
    const mask = `url("/icons/icons8/${id}.png")`
    const maskStyle: CSSProperties = {
      WebkitMaskImage: mask,
      maskImage: mask,
      WebkitMaskSize: "100% 100%",
      maskSize: "100% 100%",
      WebkitMaskRepeat: "no-repeat",
      maskRepeat: "no-repeat",
      maskMode: "alpha",
      ...style,
    }
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        width={size}
        height={size}
        color={color}
        fill="currentColor"
        focusable="false"
        aria-hidden={named ? undefined : true}
        role={named ? "img" : undefined}
        className={className ? `oc-icon ${className}` : "oc-icon"}
        style={maskStyle}
        data-icon-pack="m_outlined"
        data-icon={name}
        {...props}
      >
        {title && <title>{title}</title>}
        <rect width="24" height="24" fill="currentColor" stroke="none" />
        {children}
      </svg>
    )
  }
  Icon.displayName = name
  return Icon
}

// Catalog IDs are pinned in icons8.json. Add icons through the Icons8 MCP.
export const Archive = /* @__PURE__ */ createIcon("Archive", "82465")
export const ArrowDown = /* @__PURE__ */ createIcon("ArrowDown", "86293")
export const ArrowLeft = /* @__PURE__ */ createIcon("ArrowLeft", "87017")
export const ArrowRight = /* @__PURE__ */ createIcon("ArrowRight", "85463")
export const ArrowUp = /* @__PURE__ */ createIcon("ArrowUp", "87702")
export const ArrowUpRight = /* @__PURE__ */ createIcon("ArrowUpRight", "99506")
export const BarChart3 = /* @__PURE__ */ createIcon("BarChart3", "86286")
export const Bell = /* @__PURE__ */ createIcon("Bell", "82754")
export const BookOpen = /* @__PURE__ */ createIcon("BookOpen", "101175")
export const Bookmark = /* @__PURE__ */ createIcon("Bookmark", "82461")
export const BookmarkCheck = /* @__PURE__ */ createIcon("BookmarkCheck", "82461")
export const Briefcase = /* @__PURE__ */ createIcon("Briefcase", "82466")
export const BriefcaseBusiness = /* @__PURE__ */ createIcon("BriefcaseBusiness", "82466")
export const Building2 = /* @__PURE__ */ createIcon("Building2", "86622")
export const CalendarClock = /* @__PURE__ */ createIcon("CalendarClock", "85783")
export const CalendarDays = /* @__PURE__ */ createIcon("CalendarDays", "84997")
export const CalendarPlus = /* @__PURE__ */ createIcon("CalendarPlus", "116220")
export const Camera = /* @__PURE__ */ createIcon("Camera", "85001")
export const ChartNoAxesColumnIncreasing = /* @__PURE__ */ createIcon("ChartNoAxesColumnIncreasing", "86286")
export const ChartNoAxesCombined = /* @__PURE__ */ createIcon("ChartNoAxesCombined", "83248")
export const Check = /* @__PURE__ */ createIcon("Check", "82769")
export const CheckCheck = /* @__PURE__ */ createIcon("CheckCheck", "83235")
export const CheckCircle2 = /* @__PURE__ */ createIcon("CheckCircle2", "82766")
export const CheckIcon = /* @__PURE__ */ createIcon("CheckIcon", "82769")
export const ChevronDown = /* @__PURE__ */ createIcon("ChevronDown", "85018")
export const ChevronDownIcon = /* @__PURE__ */ createIcon("ChevronDownIcon", "85018")
export const ChevronLeft = /* @__PURE__ */ createIcon("ChevronLeft", "84994")
export const ChevronLeftIcon = /* @__PURE__ */ createIcon("ChevronLeftIcon", "84994")
export const ChevronRight = /* @__PURE__ */ createIcon("ChevronRight", "86517")
export const ChevronRightIcon = /* @__PURE__ */ createIcon("ChevronRightIcon", "86517")
export const ChevronUp = /* @__PURE__ */ createIcon("ChevronUp", "86205")
export const ChevronUpIcon = /* @__PURE__ */ createIcon("ChevronUpIcon", "86205")
export const ChevronsUpDown = /* @__PURE__ */ createIcon("ChevronsUpDown", "100654")
export const Circle = /* @__PURE__ */ createIcon("Circle", "101901")
export const CircleHelp = /* @__PURE__ */ createIcon("CircleHelp", "83244")
export const CircleIcon = /* @__PURE__ */ createIcon("CircleIcon", "101901")
export const ClipboardCheck = /* @__PURE__ */ createIcon("ClipboardCheck", "88393")
export const ClipboardList = /* @__PURE__ */ createIcon("ClipboardList", "98026")
export const Clock = /* @__PURE__ */ createIcon("Clock", "82767")
export const Clock3 = /* @__PURE__ */ createIcon("Clock3", "82767")
export const Compass = /* @__PURE__ */ createIcon("Compass", "88004")
export const Copy = /* @__PURE__ */ createIcon("Copy", "86206")
export const DoorOpen = /* @__PURE__ */ createIcon("DoorOpen", "88002")
export const Download = /* @__PURE__ */ createIcon("Download", "86327")
export const ExternalLink = /* @__PURE__ */ createIcon("ExternalLink", "82787")
export const Eye = /* @__PURE__ */ createIcon("Eye", "85028")
export const FileCheck2 = /* @__PURE__ */ createIcon("FileCheck2", "111782")
export const FileDown = /* @__PURE__ */ createIcon("FileDown", "86327")
export const FilePenLine = /* @__PURE__ */ createIcon("FilePenLine", "85925")
export const FileText = /* @__PURE__ */ createIcon("FileText", "82775")
export const Globe = /* @__PURE__ */ createIcon("Globe", "89777")
export const Globe2 = /* @__PURE__ */ createIcon("Globe2", "89777")
export const GraduationCap = /* @__PURE__ */ createIcon("GraduationCap", "99038")
export const GripVertical = /* @__PURE__ */ createIcon("GripVertical", "99436")
export const GripVerticalIcon = /* @__PURE__ */ createIcon("GripVerticalIcon", "99436")
export const Heart = /* @__PURE__ */ createIcon("Heart", "85038")
export const Home = /* @__PURE__ */ createIcon("Home", "83326")
export const IdCard = /* @__PURE__ */ createIcon("IdCard", "86793")
export const ImageIcon = /* @__PURE__ */ createIcon("ImageIcon", "112856")
export const ImagePlus = /* @__PURE__ */ createIcon("ImagePlus", "111341")
export const Info = /* @__PURE__ */ createIcon("Info", "82742")
export const Instagram = /* @__PURE__ */ createIcon("Instagram", "85154")
export const Layers = /* @__PURE__ */ createIcon("Layers", "113299")
export const LayoutGrid = /* @__PURE__ */ createIcon("LayoutGrid", "97977")
export const Lightbulb = /* @__PURE__ */ createIcon("Lightbulb", "82797")
export const Link2 = /* @__PURE__ */ createIcon("Link2", "85777")
export const LinkIcon = /* @__PURE__ */ createIcon("LinkIcon", "85777")
export const Linkedin = /* @__PURE__ */ createIcon("Linkedin", "85044")
export const ListChecks = /* @__PURE__ */ createIcon("ListChecks", "86475")
export const Loader2 = /* @__PURE__ */ createIcon("Loader2", "93005")
export const Loader2Icon = /* @__PURE__ */ createIcon("Loader2Icon", "93005")
export const LoaderCircle = /* @__PURE__ */ createIcon("LoaderCircle", "93005")
export const Lock = /* @__PURE__ */ createIcon("Lock", "82747")
export const LockKeyhole = /* @__PURE__ */ createIcon("LockKeyhole", "82747")
export const LogIn = /* @__PURE__ */ createIcon("LogIn", "82786")
export const LogOut = /* @__PURE__ */ createIcon("LogOut", "82792")
export const Mail = /* @__PURE__ */ createIcon("Mail", "86840")
export const MailOpen = /* @__PURE__ */ createIcon("MailOpen", "87350")
export const MapPin = /* @__PURE__ */ createIcon("MapPin", "85049")
export const MapPinned = /* @__PURE__ */ createIcon("MapPinned", "85931")
export const Maximize2 = /* @__PURE__ */ createIcon("Maximize2", "98023")
export const Megaphone = /* @__PURE__ */ createIcon("Megaphone", "86968")
export const Menu = /* @__PURE__ */ createIcon("Menu", "82749")
export const MessageSquare = /* @__PURE__ */ createIcon("MessageSquare", "82546")
export const MessageSquareText = /* @__PURE__ */ createIcon("MessageSquareText", "82546")
export const MinusIcon = /* @__PURE__ */ createIcon("MinusIcon", "85458")
export const Monitor = /* @__PURE__ */ createIcon("Monitor", "85457")
export const MoreHorizontal = /* @__PURE__ */ createIcon("MoreHorizontal", "85460")
export const MoreHorizontalIcon = /* @__PURE__ */ createIcon("MoreHorizontalIcon", "85460")
export const Mountain = /* @__PURE__ */ createIcon("Mountain", "92490")
export const Palette = /* @__PURE__ */ createIcon("Palette", "86294")
export const PanelLeftIcon = /* @__PURE__ */ createIcon("PanelLeftIcon", "83291")
export const PartyPopper = /* @__PURE__ */ createIcon("PartyPopper", "PzWXMazyNXW0")
export const Pause = /* @__PURE__ */ createIcon("Pause", "85932")
export const Pencil = /* @__PURE__ */ createIcon("Pencil", "86373")
export const Play = /* @__PURE__ */ createIcon("Play", "85061")
export const Plus = /* @__PURE__ */ createIcon("Plus", "96645")
export const Radio = /* @__PURE__ */ createIcon("Radio", "101887")
export const RefreshCw = /* @__PURE__ */ createIcon("RefreshCw", "82542")
export const RotateCcw = /* @__PURE__ */ createIcon("RotateCcw", "82732")
export const Rows3 = /* @__PURE__ */ createIcon("Rows3", "MaC75ir4ulrF")
export const Search = /* @__PURE__ */ createIcon("Search", "82712")
export const SearchIcon = /* @__PURE__ */ createIcon("SearchIcon", "82712")
export const Send = /* @__PURE__ */ createIcon("Send", "85940")
export const Settings = /* @__PURE__ */ createIcon("Settings", "82535")
export const Settings2 = /* @__PURE__ */ createIcon("Settings2", "82535")
export const Shield = /* @__PURE__ */ createIcon("Shield", "87367")
export const ShieldAlert = /* @__PURE__ */ createIcon("ShieldAlert", "101904")
export const ShieldCheck = /* @__PURE__ */ createIcon("ShieldCheck", "85778")
export const Shuffle = /* @__PURE__ */ createIcon("Shuffle", "103557")
export const SlidersHorizontal = /* @__PURE__ */ createIcon("SlidersHorizontal", "82459")
export const Smartphone = /* @__PURE__ */ createIcon("Smartphone", "87202")
export const Sparkles = /* @__PURE__ */ createIcon("Sparkles", "i9i0mLdBTSia")
export const StickyNote = /* @__PURE__ */ createIcon("StickyNote", "86843")
export const Table2 = /* @__PURE__ */ createIcon("Table2", "99488")
export const Trash2 = /* @__PURE__ */ createIcon("Trash2", "85081")
export const Triangle = /* @__PURE__ */ createIcon("Triangle", "98464")
export const TriangleAlert = /* @__PURE__ */ createIcon("TriangleAlert", "82783")
export const Trophy = /* @__PURE__ */ createIcon("Trophy", "85613")
export const Unlock = /* @__PURE__ */ createIcon("Unlock", "82705")
export const Upload = /* @__PURE__ */ createIcon("Upload", "82709")
export const UploadCloud = /* @__PURE__ */ createIcon("UploadCloud", "101902")
export const UserCog = /* @__PURE__ */ createIcon("UserCog", "102885")
export const UserPlus = /* @__PURE__ */ createIcon("UserPlus", "85445")
export const UserRound = /* @__PURE__ */ createIcon("UserRound", "82751")
export const Users = /* @__PURE__ */ createIcon("Users", "87209")
export const Users2 = /* @__PURE__ */ createIcon("Users2", "87209")
export const Video = /* @__PURE__ */ createIcon("Video", "88171")
export const X = /* @__PURE__ */ createIcon("X", "82771")
export const XCircle = /* @__PURE__ */ createIcon("XCircle", "82764")
export const XIcon = /* @__PURE__ */ createIcon("XIcon", "82771")
export const Zap = /* @__PURE__ */ createIcon("Zap", "86554")
