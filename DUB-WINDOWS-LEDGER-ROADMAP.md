# DUB WINDOWS LEDGER

**Product name:** DUB WINDOWS LEDGER  
**Developer:** Shakeel Faisal  
**Project target:** A 64-bit desktop operating system with a Windows-inspired desktop experience and optional Android application support.

## Project direction

This is a new development line based on the existing DUB LEDGER 14.1 PRO build kit. The existing `dub-ledger-13-1`, `dub-ledger-14-01`, and `dub-ledger-14-1-pro` branches are preserved and are not to be overwritten.

## Required deliverables

1. Windows-inspired desktop layout: panel/taskbar, application menu, desktop shortcuts, file manager, dark/light theme options, and DUB branding.
2. Clear OS identity in `/etc/os-release`, installer labels, login screen, desktop About dialog, and boot splash: **DUB WINDOWS LEDGER**.
3. Developer credit: **Shakeel Faisal**.
4. Network support: NetworkManager, common Wi-Fi firmware, Bluetooth/BlueZ, and hardware-dependent firmware checks.
5. Android application support as a separately testable feature using a compatible Android container/runtime (evaluate Waydroid and required kernel binder support). Do not claim Android apps or Google Play are installed until the runtime and a real app launch test pass.
6. Google Play support is conditional: verify a compatible GApps image, account sign-in, certification/licensing constraints, and successful app installation. Do not promise Play Store availability in advance.
7. Produce a bootable amd64 ISO and checksum, plus an English (United States) installation guide.
8. Test in a virtual machine first, then test Wi-Fi, Bluetooth, display, installer, boot, and Android runtime on representative physical hardware.

## Safety requirements

- Never overwrite the existing DUB LEDGER release branches.
- Installer must default to manual partitioning guidance; never silently select “use entire disk.”
- Explicitly warn that formatting the selected system partition erases its contents.
- Do not claim D:, E:, or other data partitions are safe without checking the actual partition layout and final installer summary on the target computer.
- Keep UEFI EFI System Partition instructions explicit and require review before formatting.

## Current baseline assessment (2026-11-28)

The source branch `dub-ledger-14-1-pro` has a successful GitHub Actions ISO build and static ISO validation. That baseline is Debian GNU/Linux 13 (Trixie) with XFCE, Arc-Dark/Papirus styling, network/Bluetooth packages, a branded wallpaper, and a Plymouth boot identity.

The baseline is **not** Microsoft Windows and does **not** currently include a working Android runtime or Google Play Store. Its successful cloud build/static validation is not a substitute for a VM boot test or physical-hardware test.

## Release gate

Do not label this project complete until the Windows-inspired desktop is present in the ISO, Android runtime tests pass (or the feature is clearly marked unsupported on the target hardware), the ISO boots in a VM, installer partition choices are reviewed, and checksums and installation instructions are published.
