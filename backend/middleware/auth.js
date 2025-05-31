// 개발 편의상 인증 과정을 우회한다.
// 모든 요청에 기본 사용자 정보를 주입하여 인증 없이도 API를 사용할 수 있다.
const auth = async (req, res, next) => {
  req.user = {
    id: '000000000000000000000000',
    role: 'admin'
  };
  req.fullUser = {
    _id: '000000000000000000000000',
    name: 'Anonymous',
    role: 'admin'
  };
  next();
};

module.exports = auth;