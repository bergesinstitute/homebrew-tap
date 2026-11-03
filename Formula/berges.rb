class Berges < Formula
  desc "Berges AI as an agent in your terminal, built on pi"
  homepage "https://berges.ai/help/use-berges-ai-in-your-terminal"
  url "https://github.com/bergesinstitute/homebrew-tap/archive/refs/tags/berges-v0.2.1.tar.gz"
  sha256 "08c7a0d8a13b61241694079ffdafa3e238e897b9be8049cd9b7970eb31f89254"
  head "https://github.com/bergesinstitute/homebrew-tap.git", branch: "master"

  depends_on "fd"
  depends_on "jq"
  depends_on "pi-coding-agent"
  depends_on "ripgrep"

  def install
    bin.install "berges/bin/berges"
    pkgshare.install "berges/extension"
  end

  test do
    assert_match version.to_s, shell_output("#{bin}/berges --version")
  end
end
