class Berges < Formula
  desc "Berges AI as an agent in your terminal, built on pi"
  homepage "https://berges.ai/help/use-berges-ai-in-your-terminal"
  url "https://github.com/bergesinstitute/homebrew-tap/archive/refs/tags/berges-v0.2.12.tar.gz"
  sha256 "69999f4424440b199c5e265df5d078b8d28645faec25e047bd1761484dff6ffc"
  head "https://github.com/bergesinstitute/homebrew-tap.git", branch: "master"

  depends_on "fd"
  depends_on "jq"
  depends_on "pi-coding-agent"
  depends_on "ripgrep"

  def install
    bin.install "berges/bin/berges"
    pkgshare.install "berges/extension"
    pkgshare.install "berges/themes"
  end

  test do
    assert_match version.to_s, shell_output("#{bin}/berges --version")
  end
end
