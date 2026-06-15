// import { useTranslations } from 'next-intl';
import { useUniqueId } from "@/hooks/useUniqueId";
import { type KeyOfMap } from "@/types/KeyOfMap";

type SvgProps = React.ComponentProps<"svg">;
type SymbolProps = React.ComponentProps<"symbol">;
type IconProps<T extends "svg" | "symbol"> = T extends "svg"
  ? SvgProps & { as?: "svg"; title?: string }
  : SymbolProps & { as: "symbol"; title?: string };

// type Test = ValueOfMap<typeof iconPathData>;

const withDefaultIconProps = <T extends "svg" | "symbol">(
  Component: React.ComponentType<IconProps<T>>,
) => {
  return (props: IconProps<T>) => {
    const defaultProps: Partial<IconProps<T>> = {
      width: "16px",
      height: "16px",
      // fill: "currentColor",
      xmlns: "http://www.w3.org/2000/svg",
      viewBox: "0 -960 960 960",
      ...props,
    };
    return <Component {...(defaultProps as IconProps<T>)} />;
  };
};

export const createIcon = (name: KeyOfMap<typeof iconPathData>, label: string) =>
  withDefaultIconProps(<T extends "svg" | "symbol">({ as = "svg", ...props }: IconProps<T>) => {
    // const t = useTranslations('ui');
    const id = useUniqueId(name);
    // const title = props.title ?? t(label);
    const title = props.title ?? label;
    if (!iconPathData.has(name)) {
      throw new Error(`No path data for icon ${name}`);
    }
    const pathData = iconPathData.get(name) as string;

    if (as === "symbol") {
      return (
        <symbol {...(props as SymbolProps)} id={`icon-${name}`}>
          <title>{title}</title>
          <IconPath pathData={pathData} />
        </symbol>
      );
    }

    return (
      <svg {...(props as SvgProps)} aria-labelledby={`${id}`} role="img">
        <title id={`${id}`}>{title}</title>
        <IconPath pathData={pathData} />
      </svg>
    );
  });

const IconPath = ({ pathData }: { pathData: string }) => <path d={pathData} />;

const iconPathData = new Map<string, string>([
  ["Add", "M440-440H200v-80h240v-240h80v240h240v80H520v240h-80v-240Z"],
  [
    "FontIncrease",
    "M679.9203-445.4183v-287l-103 103-57-56 200-200 200 200-57 56-103-103v287ZM80.6821-81.0837h100.8l52.8-146.4h230.4l52.8 146.4h100.8l-218.4-576h-100.8zm182.4-230.4 84-237.6h4.8l84 237.6z",
  ],
  [
    "FontDecrease",
    "M758.9566-878.0978v287l103-103 57 56-200 200-200-200 57-56 103 103v-287ZM80.6821-81.0837h100.8l52.8-146.4h230.4l52.8 146.4h100.8l-218.4-576h-100.8zm182.4-230.4 84-237.6h4.8l84 237.6z",
  ],
  [
    "AddCircle",
    "M440-280h80v-160h160v-80H520v-160h-80v160H280v80h160v160Zm40 200q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm0-80q134 0 227-93t93-227q0-134-93-227t-227-93q-134 0-227 93t-93 227q0 134 93 227t227 93Zm0-320Z",
  ],
  ["ArrowDropDown", "M480-360 280-560h400L480-360Z"],
  ["ArrowDropUp", "m280-400 200-200 200 200H280Z"],
  ["ArrowLeft", "M560-280 360-480l200-200v400Z"],
  ["ArrowRight", "M400-280v-400l200 200-200 200Z"],
  [
    "BottomPanelClose",
    "m480-500 160-160H320l160 160Zm280-340q33 0 56.5 23.5T840-760v560q0 33-23.5 56.5T760-120H200q-33 0-56.5-23.5T120-200v-560q0-33 23.5-56.5T200-840h560ZM200-320v120h560v-120H200Zm560-80v-360H200v360h560Zm-560 80v120-120Z",
  ],
  [
    "BottomPanelOpen",
    "M320-500h320L480-660 320-500ZM200-120q-33 0-56.5-23.5T120-200v-560q0-33 23.5-56.5T200-840h560q33 0 56.5 23.5T840-760v560q0 33-23.5 56.5T760-120H200Zm0-200v120h560v-120H200Zm0-80h560v-360H200v360Zm0 80v120-120Z",
  ],
  [
    "Cancel",
    "m336-280 144-144 144 144 56-56-144-144 144-144-56-56-144 144-144-144-56 56 144 144-144 144 56 56ZM480-80q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm0-80q134 0 227-93t93-227q0-134-93-227t-227-93q-134 0-227 93t-93 227q0 134 93 227t227 93Zm0-320Z",
  ],
  ["ChevronLeft", "M560-240 320-480l240-240 56 56-184 184 184 184-56 56Z"],
  ["ChevronRight", "M504-480 320-664l56-56 240 240-240 240-56-56 184-184Z"],
  [
    "CheckBoxOutlineBlank",
    "M200-120q-33 0-56.5-23.5T120-200v-560q0-33 23.5-56.5T200-840h560q33 0 56.5 23.5T840-760v560q0 33-23.5 56.5T760-120H200Zm0-80h560v-560H200v560Z",
  ],
  [
    "CheckBox",
    "m424-312 282-282-56-56-226 226-114-114-56 56 170 170ZM200-120q-33 0-56.5-23.5T120-200v-560q0-33 23.5-56.5T200-840h560q33 0 56.5 23.5T840-760v560q0 33-23.5 56.5T760-120H200Zm0-80h560v-560H200v560Zm0-560v560-560Z",
  ],
  [
    "Close",
    "m256-200-56-56 224-224-224-224 56-56 224 224 224-224 56 56-224 224 224 224-56 56-224-224-224 224Z",
  ],
  [
    "Delete",
    "M280-120q-33 0-56.5-23.5T200-200v-520h-40v-80h200v-40h240v40h200v80h-40v520q0 33-23.5 56.5T680-120H280Zm400-600H280v520h400v-520ZM360-280h80v-360h-80v360Zm160 0h80v-360h-80v360ZM280-720v520-520Z",
  ],
  [
    "Download",
    "M480-320 280-520l56-58 104 104v-326h80v326l104-104 56 58-200 200ZM240-160q-33 0-56.5-23.5T160-240v-120h80v120h480v-120h80v120q0 33-23.5 56.5T720-160H240Z",
  ],
  [
    "DarkMode",
    "M480-120q-150 0-255-105T120-480q0-150 105-255t255-105q14 0 27.5 1t26.5 3q-41 29-65.5 75.5T444-660q0 90 63 153t153 63q55 0 101-24.5t75-65.5q2 13 3 26.5t1 27.5q0 150-105 255T480-120Zm0-80q88 0 158-48.5T740-375q-20 5-40 8t-40 3q-123 0-209.5-86.5T364-660q0-20 3-40t8-40q-78 32-126.5 102T200-480q0 116 82 198t198 82Zm-10-270Z",
  ],
  ["DownloadDone", "M382-320 155-547l57-57 170 170 366-366 57 57-423 423ZM200-160v-80h560v80H200Z"],
  [
    "DragIndicator",
    "M360-160q-33 0-56.5-23.5T280-240q0-33 23.5-56.5T360-320q33 0 56.5 23.5T440-240q0 33-23.5 56.5T360-160Zm240 0q-33 0-56.5-23.5T520-240q0-33 23.5-56.5T600-320q33 0 56.5 23.5T680-240q0 33-23.5 56.5T600-160ZM360-400q-33 0-56.5-23.5T280-480q0-33 23.5-56.5T360-560q33 0 56.5 23.5T440-480q0 33-23.5 56.5T360-400Zm240 0q-33 0-56.5-23.5T520-480q0-33 23.5-56.5T600-560q33 0 56.5 23.5T680-480q0 33-23.5 56.5T600-400ZM360-640q-33 0-56.5-23.5T280-720q0-33 23.5-56.5T360-800q33 0 56.5 23.5T440-720q0 33-23.5 56.5T360-640Zm240 0q-33 0-56.5-23.5T520-720q0-33 23.5-56.5T600-800q33 0 56.5 23.5T680-720q0 33-23.5 56.5T600-640Z",
  ],
  [
    "Edit",
    "M200-200h57l391-391-57-57-391 391v57Zm-80 80v-170l528-527q12-11 26.5-17t30.5-6q16 0 31 6t26 18l55 56q12 11 17.5 26t5.5 30q0 16-5.5 30.5T846-647L319-120H120Zm640-584-56-56 56 56Zm-141 85-28-29 57 57-29-28Z",
  ],
  [
    "EditAttributes",
    "M280-280q-83 0-141.5-58.5T80-480q0-83 58.5-141.5T280-680h400q83 0 141.5 58.5T880-480q0 83-58.5 141.5T680-280H280Zm0-80h400q50 0 85-35t35-85q0-50-35-85t-85-35H280q-50 0-85 35t-35 85q0 50 35 85t85 35Zm42-28 142-142-42-42-100 100-40-40-42 42 82 82Zm158-92Z",
  ],
  [
    "EmergencyHome",
    "M480-79q-16 0-30.5-6T423-102L102-423q-11-12-17-26.5T79-480q0-16 6-31t17-26l321-321q12-12 26.5-17.5T480-881q16 0 31 5.5t26 17.5l321 321q12 11 17.5 26t5.5 31q0 16-5.5 30.5T858-423L537-102q-11 11-26 17t-31 6Zm0-80 321-321-321-321-321 321 321 321Zm-40-281h80v-240h-80v240Zm40 120q17 0 28.5-11.5T520-360q0-17-11.5-28.5T480-400q-17 0-28.5 11.5T440-360q0 17 11.5 28.5T480-320Zm0-160Z",
  ],
  [
    "Error",
    "M480-280q17 0 28.5-11.5T520-320q0-17-11.5-28.5T480-360q-17 0-28.5 11.5T440-320q0 17 11.5 28.5T480-280Zm-40-160h80v-240h-80v240Zm40 360q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm0-80q134 0 227-93t93-227q0-134-93-227t-227-93q-134 0-227 93t-93 227q0 134 93 227t227 93Zm0-320Z",
  ],
  [
    "EventList",
    "M640-120q-33 0-56.5-23.5T560-200v-160q0-33 23.5-56.5T640-440h160q33 0 56.5 23.5T880-360v160q0 33-23.5 56.5T800-120H640Zm0-80h160v-160H640v160ZM80-240v-80h360v80H80Zm560-280q-33 0-56.5-23.5T560-600v-160q0-33 23.5-56.5T640-840h160q33 0 56.5 23.5T880-760v160q0 33-23.5 56.5T800-520H640Zm0-80h160v-160H640v160ZM80-640v-80h360v80H80Zm640 360Zm0-400Z",
  ],
  [
    "Feedback",
    "M480-360q17 0 28.5-11.5T520-400q0-17-11.5-28.5T480-440q-17 0-28.5 11.5T440-400q0 17 11.5 28.5T480-360Zm-40-160h80v-240h-80v240ZM80-80v-720q0-33 23.5-56.5T160-880h640q33 0 56.5 23.5T880-800v480q0 33-23.5 56.5T800-240H240L80-80Zm126-240h594v-480H160v525l46-45Zm-46 0v-480 480Z",
  ],
  [
    "Fingerprint",
    "M481-781q106 0 200 45.5T838-604q7 9 4.5 16t-8.5 12q-6 5-14 4.5t-14-8.5q-55-78-141.5-119.5T481-741q-97 0-182 41.5T158-580q-6 9-14 10t-14-4q-7-5-8.5-12.5T126-602q62-85 155.5-132T481-781Zm0 94q135 0 232 90t97 223q0 50-35.5 83.5T688-257q-51 0-87.5-33.5T564-374q0-33-24.5-55.5T481-452q-34 0-58.5 22.5T398-374q0 97 57.5 162T604-121q9 3 12 10t1 15q-2 7-8 12t-15 3q-104-26-170-103.5T358-374q0-50 36-84t87-34q51 0 87 34t36 84q0 33 25 55.5t59 22.5q34 0 58-22.5t24-55.5q0-116-85-195t-203-79q-118 0-203 79t-85 194q0 24 4.5 60t21.5 84q3 9-.5 16T208-205q-8 3-15.5-.5T182-217q-15-39-21.5-77.5T154-374q0-133 96.5-223T481-687Zm0-192q64 0 125 15.5T724-819q9 5 10.5 12t-1.5 14q-3 7-10 11t-17-1q-53-27-109.5-41.5T481-839q-58 0-114 13.5T260-783q-8 5-16 2.5T232-791q-4-8-2-14.5t10-11.5q56-30 117-46t124-16Zm0 289q93 0 160 62.5T708-374q0 9-5.5 14.5T688-354q-8 0-14-5.5t-6-14.5q0-75-55.5-125.5T481-550q-76 0-130.5 50.5T296-374q0 81 28 137.5T406-123q6 6 6 14t-6 14q-6 6-14 6t-14-6q-59-62-90.5-126.5T256-374q0-91 66-153.5T481-590Zm-1 196q9 0 14.5 6t5.5 14q0 75 54 123t126 48q6 0 17-1t23-3q9-2 15.5 2.5T744-191q2 8-3 14t-13 8q-18 5-31.5 5.5t-16.5.5q-89 0-154.5-60T460-374q0-8 5.5-14t14.5-6Z",
  ],
  ["FirstPage", "M240-240v-480h80v480h-80Zm440 0L440-480l240-240 56 56-184 184 184 184-56 56Z"],
  [
    "Info",
    "M440-280h80v-240h-80v240Zm40-320q17 0 28.5-11.5T520-640q0-17-11.5-28.5T480-680q-17 0-28.5 11.5T440-640q0 17 11.5 28.5T480-600Zm0 520q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm0-80q134 0 227-93t93-227q0-134-93-227t-227-93q-134 0-227 93t-93 227q0 134 93 227t227 93Zm0-320Z",
  ],
  [
    "IndeterminateCheckBox",
    "M280-440h400v-80H280v80Zm-80 320q-33 0-56.5-23.5T120-200v-560q0-33 23.5-56.5T200-840h560q33 0 56.5 23.5T840-760v560q0 33-23.5 56.5T760-120H200Zm0-80h560v-560H200v560Zm0-560v560-560Z",
  ],
  [
    "Input",
    "M160-160q-33 0-56.5-23.5T80-240v-120h80v120h640v-480H160v120H80v-120q0-33 23.5-56.5T160-800h640q33 0 56.5 23.5T880-720v480q0 33-23.5 56.5T800-160H160Zm300-140-56-58 83-82H80v-80h407l-83-82 56-58 180 180-180 180Z",
  ],
  ["LastPage", "m280-240-56-56 184-184-184-184 56-56 240 240-240 240Zm360 0v-480h80v480h-80Z"],
  [
    "LeftPanelClose",
    "M660-320v-320L500-480l160 160ZM200-120q-33 0-56.5-23.5T120-200v-560q0-33 23.5-56.5T200-840h560q33 0 56.5 23.5T840-760v560q0 33-23.5 56.5T760-120H200Zm120-80v-560H200v560h120Zm80 0h360v-560H400v560Zm-80 0H200h120Z",
  ],
  [
    "LeftPanelOpen",
    "M500-640v320l160-160-160-160ZM200-120q-33 0-56.5-23.5T120-200v-560q0-33 23.5-56.5T200-840h560q33 0 56.5 23.5T840-760v560q0 33-23.5 56.5T760-120H200Zm120-80v-560H200v560h120Zm80 0h360v-560H400v560Zm-80 0H200h120Z",
  ],
  [
    "List",
    "M280-600v-80h560v80H280Zm0 160v-80h560v80H280Zm0 160v-80h560v80H280ZM160-600q-17 0-28.5-11.5T120-640q0-17 11.5-28.5T160-680q17 0 28.5 11.5T200-640q0 17-11.5 28.5T160-600Zm0 160q-17 0-28.5-11.5T120-480q0-17 11.5-28.5T160-520q17 0 28.5 11.5T200-480q0 17-11.5 28.5T160-440Zm0 160q-17 0-28.5-11.5T120-320q0-17 11.5-28.5T160-360q17 0 28.5 11.5T200-320q0 17-11.5 28.5T160-280Z",
  ],
  [
    "Lists",
    "M80-160v-160h160v160H80Zm240 0v-160h560v160H320ZM80-400v-160h160v160H80Zm240 0v-160h560v160H320ZM80-640v-160h160v160H80Zm240 0v-160h560v160H320Z",
  ],
  [
    "Login",
    "M480-120v-80h280v-560H480v-80h280q33 0 56.5 23.5T840-760v560q0 33-23.5 56.5T760-120H480Zm-80-160-55-58 102-102H120v-80h327L345-622l55-58 200 200-200 200Z",
  ],
  [
    "Logout",
    "M200-120q-33 0-56.5-23.5T120-200v-560q0-33 23.5-56.5T200-840h280v80H200v560h280v80H200Zm440-160-55-58 102-102H360v-80h327L585-622l55-58 200 200-200 200Z",
  ],
  [
    "List",
    "M280-600v-80h560v80H280Zm0 160v-80h560v80H280Zm0 160v-80h560v80H280ZM160-600q-17 0-28.5-11.5T120-640q0-17 11.5-28.5T160-680q17 0 28.5 11.5T200-640q0 17-11.5 28.5T160-600Zm0 160q-17 0-28.5-11.5T120-480q0-17 11.5-28.5T160-520q17 0 28.5 11.5T200-480q0 17-11.5 28.5T160-440Zm0 160q-17 0-28.5-11.5T120-320q0-17 11.5-28.5T160-360q17 0 28.5 11.5T200-320q0 17-11.5 28.5T160-280Z",
  ],
  [
    "LightMode",
    "M480-360q50 0 85-35t35-85q0-50-35-85t-85-35q-50 0-85 35t-35 85q0 50 35 85t85 35Zm0 80q-83 0-141.5-58.5T280-480q0-83 58.5-141.5T480-680q83 0 141.5 58.5T680-480q0 83-58.5 141.5T480-280ZM200-440H40v-80h160v80Zm720 0H760v-80h160v80ZM440-760v-160h80v160h-80Zm0 720v-160h80v160h-80ZM256-650l-101-97 57-59 96 100-52 56Zm492 496-97-101 53-55 101 97-57 59Zm-98-550 97-101 59 57-100 96-56-52ZM154-212l101-97 55 53-97 101-59-57Zm326-268Z",
  ],
  ["Menu", "M120-240v-80h720v80H120Zm0-200v-80h720v80H120Zm0-200v-80h720v80H120Z"],
  [
    "MoreHoriz",
    "M240-400q-33 0-56.5-23.5T160-480q0-33 23.5-56.5T240-560q33 0 56.5 23.5T320-480q0 33-23.5 56.5T240-400Zm240 0q-33 0-56.5-23.5T400-480q0-33 23.5-56.5T480-560q33 0 56.5 23.5T560-480q0 33-23.5 56.5T480-400Zm240 0q-33 0-56.5-23.5T640-480q0-33 23.5-56.5T720-560q33 0 56.5 23.5T800-480q0 33-23.5 56.5T720-400Z",
  ],
  [
    "MoreVert",
    "M480-160q-33 0-56.5-23.5T400-240q0-33 23.5-56.5T480-320q33 0 56.5 23.5T560-240q0 33-23.5 56.5T480-160Zm0-240q-33 0-56.5-23.5T400-480q0-33 23.5-56.5T480-560q33 0 56.5 23.5T560-480q0 33-23.5 56.5T480-400Zm0-240q-33 0-56.5-23.5T400-720q0-33 23.5-56.5T480-800q33 0 56.5 23.5T560-720q0 33-23.5 56.5T480-640Z",
  ],
  [
    "OpenInNew",
    "M200-120q-33 0-56.5-23.5T120-200v-560q0-33 23.5-56.5T200-840h280v80H200v560h560v-280h80v280q0 33-23.5 56.5T760-120H200Zm188-212-56-56 372-372H560v-80h280v280h-80v-144L388-332Z",
  ],
  [
    "Publish",
    "M440-160v-326L336-382l-56-58 200-200 200 200-56 58-104-104v326h-80ZM160-600v-120q0-33 23.5-56.5T240-800h480q33 0 56.5 23.5T800-720v120h-80v-120H240v120h-80Z",
  ],
  [
    "RadioButtonUnchecked",
    "M480-80q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm0-80q134 0 227-93t93-227q0-134-93-227t-227-93q-134 0-227 93t-93 227q0 134 93 227t227 93Zm0-320Z",
  ],
  [
    "RightPanelClose",
    "M300-640v320l160-160-160-160ZM200-120q-33 0-56.5-23.5T120-200v-560q0-33 23.5-56.5T200-840h560q33 0 56.5 23.5T840-760v560q0 33-23.5 56.5T760-120H200Zm440-80h120v-560H640v560Zm-80 0v-560H200v560h360Zm80 0h120-120Z",
  ],
  [
    "RightPanelOpen",
    "M460-320v-320L300-480l160 160ZM200-120q-33 0-56.5-23.5T120-200v-560q0-33 23.5-56.5T200-840h560q33 0 56.5 23.5T840-760v560q0 33-23.5 56.5T760-120H200Zm440-80h120v-560H640v560Zm-80 0v-560H200v560h360Zm80 0h120-120Z",
  ],
  [
    "Search",
    "M784-120 532-372q-30 24-69 38t-83 14q-109 0-184.5-75.5T120-580q0-109 75.5-184.5T380-840q109 0 184.5 75.5T640-580q0 44-14 83t-38 69l252 252-56 56ZM380-400q75 0 127.5-52.5T560-580q0-75-52.5-127.5T380-760q-75 0-127.5 52.5T200-580q0 75 52.5 127.5T380-400Z",
  ],
  [
    "ToggleOn",
    "M280-240q-100 0-170-70T40-480q0-100 70-170t170-70h400q100 0 170 70t70 170q0 100-70 170t-170 70H280Zm0-80h400q66 0 113-47t47-113q0-66-47-113t-113-47H280q-66 0-113 47t-47 113q0 66 47 113t113 47Zm400-40q50 0 85-35t35-85q0-50-35-85t-85-35q-50 0-85 35t-35 85q0 50 35 85t85 35ZM480-480Z",
  ],
  [
    "ToggleOff",
    "M280-240q-100 0-170-70T40-480q0-100 70-170t170-70h400q100 0 170 70t70 170q0 100-70 170t-170 70H280Zm0-80h400q66 0 113-47t47-113q0-66-47-113t-113-47H280q-66 0-113 47t-47 113q0 66 47 113t113 47Zm0-40q50 0 85-35t35-85q0-50-35-85t-85-35q-50 0-85 35t-35 85q0 50 35 85t85 35Zm200-120Z",
  ],
  [
    "TopPanelOpen",
    "M320-500h320L480-660 320-500ZM200-120q-33 0-56.5-23.5T120-200v-560q0-33 23.5-56.5T200-840h560q33 0 56.5 23.5T840-760v560q0 33-23.5 56.5T760-120H200Zm0-200v120h560v-120H200Zm0-80h560v-360H200v360Zm0 80v120-120Z",
  ],
  [
    "TopPanelClose",
    "M480-460 320-300h320L480-460ZM200-120q-33 0-56.5-23.5T120-200v-560q0-33 23.5-56.5T200-840h560q33 0 56.5 23.5T840-760v560q0 33-23.5 56.5T760-120H200Zm560-520v-120H200v120h560Zm-560 80v360h560v-360H200Zm0-80v-120 120Z",
  ],
  [
    "RadioButtonChecked",
    "M480-280q83 0 141.5-58.5T680-480q0-83-58.5-141.5T480-680q-83 0-141.5 58.5T280-480q0 83 58.5 141.5T480-280Zm0 200q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm0-80q134 0 227-93t93-227q0-134-93-227t-227-93q-134 0-227 93t-93 227q0 134 93 227t227 93Zm0-320Z",
  ],
  [
    "Refresh",
    "M480-160q-134 0-227-93t-93-227q0-134 93-227t227-93q69 0 132 28.5T720-690v-110h80v280H520v-80h168q-32-56-87.5-88T480-720q-100 0-170 70t-70 170q0 100 70 170t170 70q77 0 139-44t87-116h84q-28 106-114 173t-196 67Z",
  ],
  [
    "Report",
    "M480-280q17 0 28.5-11.5T520-320q0-17-11.5-28.5T480-360q-17 0-28.5 11.5T440-320q0 17 11.5 28.5T480-280Zm-40-160h80v-240h-80v240ZM330-120 120-330v-300l210-210h300l210 210v300L630-120H330Zm34-80h232l164-164v-232L596-760H364L200-596v232l164 164Zm116-280Z",
  ],
  [
    "Routine",
    "M396-396q-32-32-58.5-67T289-537q-5 14-6.5 28.5T281-480q0 83 58 141t141 58q14 0 28.5-2t28.5-6q-39-22-74-48.5T396-396Zm57-56q51 51 114 87.5T702-308q-40 51-98 79.5T481-200q-117 0-198.5-81.5T201-480q0-65 28.5-123t79.5-98q20 72 56.5 135T453-452Zm290 72q-20-5-39.5-11T665-405q8-18 11.5-36.5T680-480q0-83-58.5-141.5T480-680q-20 0-38.5 3.5T405-665q-8-19-13.5-38T381-742q24-9 49-13.5t51-4.5q117 0 198.5 81.5T761-480q0 26-4.5 51T743-380ZM440-840v-120h80v120h-80Zm0 840v-120h80V0h-80Zm323-706-57-57 85-84 57 56-85 85ZM169-113l-57-56 85-85 57 57-85 84Zm671-327v-80h120v80H840ZM0-440v-80h120v80H0Zm791 328-85-85 57-57 84 85-56 57ZM197-706l-84-85 56-57 85 85-57 57Zm199 310Z",
  ],
  [
    "Settings",
    "m370-80-16-128q-13-5-24.5-12T307-235l-119 50L78-375l103-78q-1-7-1-13.5v-27q0-6.5 1-13.5L78-585l110-190 119 50q11-8 23-15t24-12l16-128h220l16 128q13 5 24.5 12t22.5 15l119-50 110 190-103 78q1 7 1 13.5v27q0 6.5-2 13.5l103 78-110 190-118-50q-11 8-23 15t-24 12L590-80H370Zm70-80h79l14-106q31-8 57.5-23.5T639-327l99 41 39-68-86-65q5-14 7-29.5t2-31.5q0-16-2-31.5t-7-29.5l86-65-39-68-99 42q-22-23-48.5-38.5T533-694l-13-106h-79l-14 106q-31 8-57.5 23.5T321-633l-99-41-39 68 86 64q-5 15-7 30t-2 32q0 16 2 31t7 30l-86 65 39 68 99-42q22 23 48.5 38.5T427-266l13 106Zm42-180q58 0 99-41t41-99q0-58-41-99t-99-41q-59 0-99.5 41T342-480q0 58 40.5 99t99.5 41Zm-2-140Z",
  ],
  [
    "UnfoldLess",
    "m356-160-56-56 180-180 180 180-56 56-124-124-124 124Zm124-404L300-744l56-56 124 124 124-124 56 56-180 180Z",
  ],
  [
    "UnfoldMore",
    "M480-120 300-300l58-58 122 122 122-122 58 58-180 180ZM358-598l-58-58 180-180 180 180-58 58-122-122-122 122Z",
  ],
  [
    "UnfoldLessDouble",
    "m354-2-56-56 183-183L664-58 608-1 481-128 354-2Zm0-200-56-56 183-183 183 183-56 57-127-127-127 126Zm127-318L297-704l57-57 127 127 126-127 57 57-183 184Zm0-200L297-904l57-57 127 127 126-127 57 57-183 184Z",
  ],
  [
    "UnfoldMoreDouble",
    "M481-1 298-184l56-56 127 126 127-127 56 57L481-1Zm0-200L298-384l56-56 127 126 127-127 56 57-183 183ZM354-520l-57-57 184-184 183 184-57 57-126-127-127 127Zm0-200-57-57 184-184 183 184-57 57-126-127-127 127Z",
  ],
  [
    "Upload",
    "M440-320v-326L336-542l-56-58 200-200 200 200-56 58-104-104v326h-80ZM240-160q-33 0-56.5-23.5T160-240v-120h80v120h480v-120h80v120q0 33-23.5 56.5T720-160H240Z",
  ],
  [
    "VideoLibrary",
    "m460-380 280-180-280-180v360ZM320-240q-33 0-56.5-23.5T240-320v-480q0-33 23.5-56.5T320-880h480q33 0 56.5 23.5T880-800v480q0 33-23.5 56.5T800-240H320Zm0-80h480v-480H320v480ZM160-80q-33 0-56.5-23.5T80-160v-560h80v560h560v80H160Zm160-720v480-480Z",
  ],
  [
    "Visibility",
    "M480-320q75 0 127.5-52.5T660-500q0-75-52.5-127.5T480-680q-75 0-127.5 52.5T300-500q0 75 52.5 127.5T480-320Zm0-72q-45 0-76.5-31.5T372-500q0-45 31.5-76.5T480-608q45 0 76.5 31.5T588-500q0 45-31.5 76.5T480-392Zm0 192q-146 0-266-81.5T40-500q54-137 174-218.5T480-800q146 0 266 81.5T920-500q-54 137-174 218.5T480-200Zm0-300Zm0 220q113 0 207.5-59.5T832-500q-50-101-144.5-160.5T480-720q-113 0-207.5 59.5T128-500q50 101 144.5 160.5T480-280Z",
  ],
  [
    "VisibilityOff",
    "m644-428-58-58q9-47-27-88t-93-32l-58-58q17-8 34.5-12t37.5-4q75 0 127.5 52.5T660-500q0 20-4 37.5T644-428Zm128 126-58-56q38-29 67.5-63.5T832-500q-50-101-143.5-160.5T480-720q-29 0-57 4t-55 12l-62-62q41-17 84-25.5t90-8.5q151 0 269 83.5T920-500q-23 59-60.5 109.5T772-302Zm20 246L624-222q-35 11-70.5 16.5T480-200q-151 0-269-83.5T40-500q21-53 53-98.5t73-81.5L56-792l56-56 736 736-56 56ZM222-624q-29 26-53 57t-41 67q50 101 143.5 160.5T480-280q20 0 39-2.5t39-5.5l-36-38q-11 3-21 4.5t-21 1.5q-75 0-127.5-52.5T300-500q0-11 1.5-21t4.5-21l-84-82Zm319 93Zm-151 75Z",
  ],
  [
    "Warning",
    "m40-120 440-760 440 760H40Zm138-80h604L480-720 178-200Zm302-40q17 0 28.5-11.5T520-280q0-17-11.5-28.5T480-320q-17 0-28.5 11.5T440-280q0 17 11.5 28.5T480-240Zm-40-120h80v-200h-80v200Zm40-100Z",
  ],
]);

export const FontIncreaseIcon = createIcon("FontIncrease", "Increase Font Size");
export const FontDecreaseIcon = createIcon("FontDecrease", "Decrease Font Size");
export const AddCircleIcon = createIcon("AddCircle", "Add");
export const AddIcon = createIcon("Add", "Add");
export const ArrowDropDownIcon = createIcon("ArrowDropDown", "Down");
export const ArrowDropUpIcon = createIcon("ArrowDropUp", "Up");
export const ArrowLeftIcon = createIcon("ArrowLeft", "Left");
export const ArrowRightIcon = createIcon("ArrowRight", "Right");
export const CancelIcon = createIcon("Cancel", "Cancel");
export const DeleteIcon = createIcon("Delete", "Delete");
export const CloseIcon = createIcon("Close", "Close");
export const CheckBoxEmptyIcon = createIcon("CheckBoxOutlineBlank", "Empty Check Box");
export const CheckBoxIcon = createIcon("CheckBox", "Check Box Checked");
export const IndeterminateCheckBoxIcon = createIcon(
  "IndeterminateCheckBox",
  "Indeterminate Checkbox",
);
export const DarkModeIcon = createIcon("DarkMode", "Dark Mode");
export const DownloadIcon = createIcon("Download", "Download");
export const DownloadDoneIcon = createIcon("DownloadDone", "Download Done");
export const DragIndicatorIcon = createIcon("DragIndicator", "Drag");
export const FingerprintIcon = createIcon("Fingerprint", "Fingerprint");
export const FirstPageIcon = createIcon("FirstPage", "First Page");
export const InfoIcon = createIcon("Info", "Info");
export const InputIcon = createIcon("Input", "Input");
export const EditIcon = createIcon("Edit", "Edit");
export const EditAttributesIcon = createIcon("EditAttributes", "Edit");
export const EmergencyHomeIcon = createIcon("EmergencyHome", "Emergency");
export const ErrorIcon = createIcon("Error", "Error");
export const EventListIcon = createIcon("EventList", "Event List");
export const LastPageIcon = createIcon("LastPage", "Last Page");
export const LightModeIcon = createIcon("LightMode", "Light Mode");
export const ListIcon = createIcon("List", "List");
export const ListsIcon = createIcon("Lists", "List");
export const LoginIcon = createIcon("Login", "Login");
export const LogoutIcon = createIcon("Logout", "Logout");
export const MenuIcon = createIcon("Menu", "Menu");
export const MoreHorizIcon = createIcon("MoreHoriz", "More");
export const MoreVertIcon = createIcon("MoreVert", "More");
export const ChevronRightIcon = createIcon("ChevronRight", "Right");
export const ChevronLeftIcon = createIcon("ChevronLeft", "Left");
export const NextIcon = createIcon("ChevronRight", "Next");
export const PrevIcon = createIcon("ChevronLeft", "Previous");
export const PublishIcon = createIcon("Publish", "Publish");
export const RefreshIcon = createIcon("Refresh", "Refresh");
export const ReportIcon = createIcon("Report", "Report");
export const TopPanelOpenIcon = createIcon("TopPanelOpen", "Open");
export const TopPanelCloseIcon = createIcon("TopPanelClose", "Close");
export const LeftPanelOpenIcon = createIcon("LeftPanelOpen", "Open");
export const LeftPanelCloseIcon = createIcon("LeftPanelClose", "Close");
export const RightPanelOpenIcon = createIcon("RightPanelOpen", "Open");
export const RightPanelCloseIcon = createIcon("RightPanelClose", "Close");
export const RadioButtonUncheckedIcon = createIcon("RadioButtonUnchecked", "Unchecked");
export const RadioButtonCheckedIcon = createIcon("RadioButtonChecked", "Checked");
export const BottomPanelOpenIcon = createIcon("BottomPanelOpen", "Open");
export const BottomPanelCloseIcon = createIcon("BottomPanelClose", "Close");
export const SystemModeIcon = createIcon("Routine", "System Default");
export const SearchIcon = createIcon("Search", "Search");
export const SettingsIcon = createIcon("Settings", "Settings");
export const ToggleOnIcon = createIcon("ToggleOn", "Toggle On");
export const ToggleOffIcon = createIcon("ToggleOff", "Toggle Off");
export const UnfoldMoreIcon = createIcon("UnfoldMore", "More");
export const UnfoldLessIcon = createIcon("UnfoldLess", "Less");
export const UploadIcon = createIcon("Upload", "Upload");
export const UnfoldMoreDoubleIcon = createIcon("UnfoldMoreDouble", "More");
export const UnfoldLessDoubleIcon = createIcon("UnfoldLessDouble", "Less");
export const VideoLibraryIcon = createIcon("VideoLibrary", "Video Library");
export const VisibilityIcon = createIcon("Visibility", "Visibility On");
export const VisibilityOffIcon = createIcon("VisibilityOff", "Visibility Off");
export const WarningIcon = createIcon("Warning", "Warning");
export const TestIcon = createIcon("Test", "Test");
